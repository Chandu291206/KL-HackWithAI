/* eslint-disable react/prop-types */
import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTopicDetail, getYoutubeVideos } from "../api/topics";
import { generateTopicTest } from "../api/tests";
import { FiArrowLeft, FiPlay, FiBookOpen, FiStar, FiCheckCircle, FiChevronRight } from "react-icons/fi";

const TOPIC_VIDEO_OVERRIDES = {
  "1": [
    {
      title: "Recommended Lecture for Topic 1",
      channel_name: "Curated Video",
      thumbnail_url: "https://img.youtube.com/vi/OH-aSu-rWgk/hqdefault.jpg",
      url: "https://youtu.be/OH-aSu-rWgk?si=_gSe_doy-k0Tr5U8",
    },
  ],
  "11": [
    {
      title: "Recommended Lecture for Topic 11",
      channel_name: "Curated Video",
      thumbnail_url: "https://img.youtube.com/vi/5yfh5cf4-0w/hqdefault.jpg",
      url: "https://youtu.be/5yfh5cf4-0w?si=MU57a1bHrbf4gle6",
    },
  ],
  "18": [
    {
      title: "Recommended Lecture for Topic 18",
      channel_name: "Curated Video",
      thumbnail_url: "https://img.youtube.com/vi/r-SCyD7f_zI/hqdefault.jpg",
      url: "https://youtu.be/r-SCyD7f_zI?si=29kfPjJjXkR6FzlN",
    },
  ],
};

export default function TopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingTest, setGeneratingTest] = useState(false);

  useEffect(() => {
    fetchData();
  }, [topicId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const topicData = await getTopicDetail(topicId);
      setTopic(topicData);

      const curatedVideos = TOPIC_VIDEO_OVERRIDES[topicId] || [];
      if (curatedVideos.length > 0) {
        setVideos(curatedVideos);
      }

      // Fetch youtube videos based on the topic name
      const videoData = await getYoutubeVideos(topicData.name);
      const fetchedVideos = videoData.videos || [];

      if (curatedVideos.length > 0) {
        const curatedUrls = new Set(curatedVideos.map((video) => video.url));
        const mergedVideos = [
          ...curatedVideos,
          ...fetchedVideos.filter((video) => !curatedUrls.has(video.url)),
        ];
        setVideos(mergedVideos);
      } else {
        setVideos(fetchedVideos);
      }
    } catch (err) {
      console.error("Failed to load topic details", err);
    } finally {
      setLoading(false);
    }
  };

  const startTopicTest = async (count = 10, difficulty = 'mixed') => {
    try {
      setGeneratingTest(true);
      const testData = await generateTopicTest(topic.id, count, difficulty);
      // Store test session in sessionStorage
      sessionStorage.setItem('currentTest', JSON.stringify({
        testId: testData.test_id,
        questions: testData.questions,
        topicName: topic.name
      }));
      navigate('/test');
    } catch (err) {
      console.error("Failed to generate test", err);
      alert("Failed to generate test. Please try again.");
    } finally {
      setGeneratingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!topic) return <div className="p-8 text-center text-red-500">Failed to load topic</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      {/* BREADCRUMBS & HEADER */}
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-6 w-fit bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
          <span className="cursor-pointer hover:text-gray-900" onClick={() => navigate('/learn')}>Subjects</span>
          <FiChevronRight className="text-gray-400" />
          <span className="cursor-pointer hover:text-gray-900" onClick={() => navigate('/learn')}>{topic.subject}</span>
          <FiChevronRight className="text-gray-400" />
          <span className="text-green-600">{topic.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-gray-900 tracking-tight">
              {topic.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full flex items-center gap-2">
                <FiStar /> Mastery: {topic.user_score ? Math.round(topic.user_score) : 0}%
              </span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full flex items-center gap-2">
                <FiBookOpen /> Theory Available
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => startTopicTest(10, 'mixed')}
              disabled={generatingTest}
              className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <FiPlay />
              {generatingTest ? "Generating..." : "Practice 10 Questions"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10 lg:items-start border-t border-gray-100 pt-10">

        {/* LEFT COLUMN: THEORY & RESOURCES */}
        <div className="lg:col-span-2 space-y-10">
          {/* QUICK SUMMARY */}
          <section className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 blur-3xl rounded-full" />
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center border border-yellow-200">
                <FiBookOpen className="text-xl" />
              </div>
              <h2 className="text-2xl font-bold">Theory Summary</h2>
            </div>
            <div className="prose max-w-none text-gray-700 leading-relaxed font-medium">
              {topic.theory_summary ? (
                <div dangerouslySetInnerHTML={{ __html: topic.theory_summary.replace(/\n\n/g, '</p><p>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              ) : (
                <p>Theory summary is currently being generated for this topic. Please check back later.</p>
              )}
            </div>
          </section>

          {/* VIDEO LECTURES */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-200 shadow-sm">
                  <FiPlay className="text-xl ml-1" />
                </div>
                <h2 className="text-2xl font-bold">Recommended Lectures</h2>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {videos.length > 0 ? (
                videos.map((video, idx) => (
                  <VideoCard
                    key={idx}
                    title={video.title}
                    channel={video.channel_name}
                    thumbnail={video.thumbnail_url}
                    url={video.url}
                  />
                ))
              ) : (
                <div className="col-span-2 text-center p-8 bg-gray-50 border border-gray-200 border-dashed rounded-xl text-gray-500">
                  No video recommendations found for this topic.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: ACTIONS & SETTINGS */}
        <div className="space-y-6 sticky top-8">
          {/* PRACTICE CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FiCheckCircle className="text-green-500" /> Let&apos;s Practice
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Test your understanding of {topic.name}. Our AI will adjust the difficulty based on your performance.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => startTopicTest(5, 'mixed')}
                disabled={generatingTest}
                className="w-full justify-between bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-gray-200 text-left px-5 py-4 rounded-xl font-bold flex flex-col gap-1 transition-all group disabled:opacity-50"
              >
                <div className="flex justify-between w-full items-center">
                  <span className="text-gray-900 group-hover:text-green-700">Quick 5</span>
                  <FiChevronRight className="text-gray-400 group-hover:text-green-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Approx 10 mins</span>
              </button>

              <button
                onClick={() => startTopicTest(10, 'mixed')}
                disabled={generatingTest}
                className="w-full justify-between bg-green-50 border border-green-200 hover:bg-green-100 text-left px-5 py-4 rounded-xl font-bold flex flex-col gap-1 transition-all group shadow-sm disabled:opacity-50"
              >
                <div className="flex justify-between w-full items-center">
                  <span className="text-green-800">Standard 10</span>
                  <FiChevronRight className="text-green-600" />
                </div>
                <span className="text-xs text-green-600 font-medium">Recommended • 20 mins</span>
              </button>

              <button
                onClick={() => startTopicTest(20, 'hard')}
                disabled={generatingTest}
                className="w-full justify-between bg-gray-50 hover:bg-red-50 hover:border-red-200 border border-gray-200 text-left px-5 py-4 rounded-xl font-bold flex flex-col gap-1 transition-all group disabled:opacity-50"
              >
                <div className="flex justify-between w-full items-center">
                  <span className="text-gray-900 group-hover:text-red-700">Hard 20 Challenge</span>
                  <FiChevronRight className="text-gray-400 group-hover:text-red-500" />
                </div>
                <span className="text-xs text-gray-500 font-medium group-hover:text-red-500/70">Test your limits • 45 mins</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



/* COMPONENTS */

function ActionBtn({ title, primary = false, icon = null }) {

  return (
    <button
      className={`w-full flex justify-between items-center p-4 rounded-xl font-bold transition-all ${primary
        ? "bg-green-400 text-black"
        : "bg-gray-50 border border-green-500/30 text-green-400"
        }`}
    >

      <div className="flex gap-3 items-center">

        {icon || <FiPlay />}

        {title}

      </div>

      <FiArrowRight />

    </button>
  );
}



function VideoCard({ title, channel, thumbnail, url }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-green-300 transition-all shadow-sm hover:shadow-md block">
      {/* THUMBNAIL */}
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {thumbnail ? (
          <img src={thumbnail} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 to-gray-50 group-hover:scale-105 transition-transform duration-500"></div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
            <FiPlay className="text-green-600 text-xl ml-1" />
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-green-700 transition-colors">
          {title}
        </div>
        <div className="text-xs text-gray-500 mt-2 font-medium flex items-center gap-1">
          {channel}
        </div>
      </div>
    </a>
  );
}
