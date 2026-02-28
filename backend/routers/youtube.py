from fastapi import APIRouter
from youtubesearchpython import VideosSearch
from typing import List, Dict
import time

router = APIRouter(
    prefix="/api/youtube",
    tags=["YouTube"],
)

# Simple in-memory cache
# Format: { "topic_name": {"timestamp": time, "results": [...]} }
YT_CACHE: Dict[str, dict] = {}
CACHE_TTL_SECONDS = 3600 # 1 hour

@router.get("/{topic_name}", response_model=List[dict])
def search_youtube(topic_name: str):
    now = time.time()
    if topic_name in YT_CACHE:
        cached = YT_CACHE[topic_name]
        if now - cached["timestamp"] < CACHE_TTL_SECONDS:
            return cached["results"]
            
    try:
        # Search for Topic + JEE NEET explanation
        query = f"{topic_name} JEE NEET explanation"
        videos_search = VideosSearch(query, limit=5)
        results = videos_search.result()
        
        filtered = []
        for vid in results.get("result", []):
            duration_str = vid.get("duration", "0:00")
            parts = duration_str.split(":")
            # If duration is like 1:30, it has 2 parts. If > 3 mins, take it.
            # If > 1 hr (e.g. 1:20:00), definitely take it.
            is_valid = True
            if len(parts) == 2:
                try:
                    mins = int(parts[0])
                    if mins < 3:
                        is_valid = False
                except ValueError:
                    pass
            
            if is_valid:
                filtered.append({
                    "title": vid.get("title"),
                    "url": vid.get("link"),
                    "thumbnail": vid.get("thumbnails", [{}])[0].get("url") if vid.get("thumbnails") else None,
                    "channel_name": vid.get("channel", {}).get("name")
                })
                
        # Take top 3
        final_results = filtered[:3]
        
        # Save to cache
        YT_CACHE[topic_name] = {
            "timestamp": now,
            "results": final_results
        }
        
        return final_results
        
    except Exception as e:
        print(f"YouTube search error: {e}")
        return [] # fail gracefully
