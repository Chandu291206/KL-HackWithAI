const nowSec = () => Date.now() / 1000;

export class BurnoutEngine {
  static DEFAULT_BREAK_SECS = 5 * 60;

  static SPIKE = {
    drowsy_event: 18,
    look_away_event: 7,
    explain_click: 5,
    answer_change_spike: 6,
  };

  static FLOOR_WEIGHTS = {
    self_report: 20,
    plan_decay: 8,
    schedule_strain: 7,
  };

  static PASSIVE_DECAY_MIN = 2;
  static NOTIFY_THRESHOLD = 60;

  constructor() {
    this.reset();
  }

  reset() {
    this.break_start = null;
    this.breakDurationSecs = BurnoutEngine.DEFAULT_BREAK_SECS;
    this.on_break = false;
    this.break_count = 0;
    this.break_notified = false;
    this.last_score = 0;

    this.fatigue_pool = 0;
    this.last_decay_time = nowSec();
    this.event_log = [];
    this.total_drowsy_events = 0;
    this.total_look_away_events = 0;

    this.answers_changed = 0;
    this.answers_submitted = 0;
    this.explain_clicks = 0;
    this.revision_spike_fired = false;

    this.self_report_value = 2;
    this.plan_completion_this_week = 1;
    this.plan_completion_last_week = 1;
    this.consecutive_study_days = 0;
    this.late_night_sessions = 0;
  }

  log_drowsy_event() {
    this.fatigue_pool = Math.min(
      65,
      this.fatigue_pool + BurnoutEngine.SPIKE.drowsy_event
    );
    this.total_drowsy_events += 1;
    this._log("Drowsy event");
  }

  log_look_away_event() {
    this.fatigue_pool = Math.min(
      65,
      this.fatigue_pool + BurnoutEngine.SPIKE.look_away_event
    );
    this.total_look_away_events += 1;
    this._log("Look away event");
  }

  log_answer_change() {
    this.answers_changed += 1;
    if (this.answers_submitted < 5 || this.revision_spike_fired) {
      return;
    }
    const rate = this.answers_changed / this.answers_submitted;
    if (rate > 0.2) {
      this.fatigue_pool = Math.min(
        65,
        this.fatigue_pool + BurnoutEngine.SPIKE.answer_change_spike
      );
      this.revision_spike_fired = true;
      this._log("Answer revision spike");
    }
  }

  log_answer_submit() {
    this.answers_submitted += 1;
    this.revision_spike_fired = false;
  }

  log_explain_click() {
    this.explain_clicks += 1;
    this.fatigue_pool = Math.min(
      65,
      this.fatigue_pool + BurnoutEngine.SPIKE.explain_click
    );
    this._log("Explain clicked");
  }

  set_self_report(value) {
    this.self_report_value = Math.max(1, Math.min(4, Number(value) || 2));
  }

  set_plan_completion(thisWeek, lastWeek) {
    this.plan_completion_this_week = Number(thisWeek) || 0;
    this.plan_completion_last_week = Number(lastWeek) || 0;
  }

  set_schedule(consecutiveDays, lateNights) {
    this.consecutive_study_days = Number(consecutiveDays) || 0;
    this.late_night_sessions = Number(lateNights) || 0;
  }

  compute() {
    this._applyPassiveDecay();
    const floor = this._compute_floor();
    const total = Math.min(100, this.fatigue_pool + floor);
    this.last_score = total;

    return {
      total: Number(total.toFixed(1)),
      fatigue_pool: Number(this.fatigue_pool.toFixed(1)),
      floor: Number(floor.toFixed(1)),
      signals: {
        fatigue_pool: Number(this.fatigue_pool.toFixed(1)),
        self_report: Number(this._floor_self_report().toFixed(1)),
        plan_decay: Number(this._floor_plan().toFixed(1)),
        schedule_strain: Number(this._floor_schedule().toFixed(1)),
      },
    };
  }

  should_notify_break() {
    if (this.on_break) {
      return false;
    }
    if (this.last_score >= BurnoutEngine.NOTIFY_THRESHOLD && !this.break_notified) {
      this.break_notified = true;
      return true;
    }
    return false;
  }

  start_break(seconds = BurnoutEngine.DEFAULT_BREAK_SECS) {
    this.on_break = true;
    this.break_start = nowSec();
    this.breakDurationSecs = seconds;
    this.break_count += 1;
  }

  end_break() {
    this.on_break = false;
    this.break_start = null;
    this.break_notified = false;
    this.fatigue_pool = Math.max(0, this.fatigue_pool * 0.2);
    this.event_log = [];
    this._log("Break completed");
  }

  break_time_remaining() {
    if (!this.on_break || !this.break_start) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor(this.breakDurationSecs - (nowSec() - this.break_start))
    );
  }

  get_stats() {
    const score = this.compute();
    return {
      burnout_score: score.total,
      fatigue_pool: score.fatigue_pool,
      floor: score.floor,
      signals: score.signals,
      break_count: this.break_count,
      answers_changed: this.answers_changed,
      explain_clicks: this.explain_clicks,
      drowsy_total: this.total_drowsy_events,
      look_away_total: this.total_look_away_events,
      event_log: [...this.event_log],
    };
  }

  static score_label(score) {
    if (score < 25) return "Fresh";
    if (score < 50) return "Tiring";
    if (score < 75) return "Fatigued";
    return "Burnt Out";
  }

  _applyPassiveDecay() {
    const now = nowSec();
    const mins_since_last_tick = (now - this.last_decay_time) / 60;
    if (mins_since_last_tick >= 0.05) {
      const decay = BurnoutEngine.PASSIVE_DECAY_MIN * mins_since_last_tick;
      this.fatigue_pool = Math.max(0, this.fatigue_pool - decay);
      this.last_decay_time = now;
    }
  }

  _compute_floor() {
    return (
      this._floor_self_report() + this._floor_plan() + this._floor_schedule()
    );
  }

  _floor_self_report() {
    const w = BurnoutEngine.FLOOR_WEIGHTS.self_report;
    return ((this.self_report_value - 1) / 3) * w;
  }

  _floor_plan() {
    const w = BurnoutEngine.FLOOR_WEIGHTS.plan_decay;
    if (this.plan_completion_last_week <= 0) return 0;
    const drop = Math.max(
      0,
      this.plan_completion_last_week - this.plan_completion_this_week
    );
    return Math.min(w, (drop / 0.4) * w);
  }

  _floor_schedule() {
    const w = BurnoutEngine.FLOOR_WEIGHTS.schedule_strain;
    const day_score = Math.min(
      4,
      (Math.max(0, this.consecutive_study_days - 6) / 4) * 4
    );
    const night_score = Math.min(3, (this.late_night_sessions / 4) * 3);
    return Math.min(w, day_score + night_score);
  }

  _log(message) {
    const stamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    this.event_log = [...this.event_log.slice(-49), `${stamp} ${message}`];
  }
}
