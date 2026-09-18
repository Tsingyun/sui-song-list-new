# -*- coding: utf-8 -*-
"""sitegen — build the single-file song-list website from data sources.

Layers:
    datalayer   song data load / enrichment / aggregate stats
    reqstats    point-song (点歌) derivations from raw_data (leaderboards,
                floor-remainder percentages, 🔥 streaks, levels, ...)
    builder     page assembly (skeleton + assets + JSON payload -> docs/index.html)
"""
