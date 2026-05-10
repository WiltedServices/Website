/* profile.js — shared logic for all Wilted Services dev profiles
   Each page must define window.PROFILE_CONFIG before loading this script:
   {
     discordId: "...",
     fallbackName: "...",
     github: "url or null",
     website: "url or null",
     role: "string or null"
   }
*/

(async function () {
  const cfg = window.PROFILE_CONFIG || {};

  const avatarImg = document.getElementById('avatar');
  const statusRing = document.getElementById('statusRing');
  const displayName = document.getElementById('displayName');
  const usernameEl = document.getElementById('username');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const activitySec = document.getElementById('activitySection');
  const activityCard = document.getElementById('activityCard');
  const spotifyCard = document.getElementById('spotifyCard');

  const githubCard = document.getElementById('githubCard');
  const websiteCard = document.getElementById('websiteCard');

  if (cfg.github && githubCard) {
    githubCard.href = cfg.github;
    githubCard.querySelector('.info-value').textContent = cfg.github.replace('https://', '');
    githubCard.classList.remove('hidden');
  }
  if (cfg.website && websiteCard) {
    websiteCard.href = cfg.website;
    websiteCard.querySelector('.info-value').textContent = cfg.website.replace('https://', '');
    websiteCard.classList.remove('hidden');
  }

  if (!cfg.discordId) return;

  async function fetchDiscordPresence(discordId) {
    const providers = [
      {
        url: id => `https://api.lanyard.rest/v1/users/${id}`,
        parse: async res => {
          const json = await res.json();
          if (!json.success) return null;
          return {
            user: json.data.discord_user,
            status: json.data.discord_status,
            spotify: json.data.spotify,
            listening_to_spotify: json.data.listening_to_spotify,
            activities: json.data.activities,
            presence: true
          };
        }
      },
      {
        url: id => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.marki.my/v1/users/${id}`)}`,
        parse: async res => {
          const json = await res.json();
          if (!json || json.error) return null;
          return {
            user: {
              id: json.id,
              username: json.username,
              global_name: json.global_name || json.display_name || json.username,
              avatar: json.avatar_url || json.avatar // Favor full URL if available
            },
            status: 'offline',
            presence: false
          };
        }
      }
    ];

    for (const provider of providers) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(provider.url(discordId), { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const profile = await provider.parse(res);
        if (profile) return profile;
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  try {
    const profile = await fetchDiscordPresence(cfg.discordId);
    if (!profile) throw new Error('API fail');

    const user = profile.user;

    if (user.avatar) {
      if (user.avatar.startsWith('http')) {
        avatarImg.src = user.avatar;
      } else {
        const isGif = user.avatar.startsWith('a_');
        avatarImg.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${isGif ? 'gif' : 'png'}?size=512`;
      }
    }

    displayName.textContent = user.global_name || user.username || cfg.fallbackName || 'Unknown';
    if (usernameEl) usernameEl.textContent = '@' + (user.username || cfg.fallbackName || 'unknown');
    document.title = (user.global_name || user.username || cfg.fallbackName || 'Profile') + ' — Wilted Services';

    const s = profile.status || 'offline';
    const statusLabels = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
    statusText.textContent = statusLabels[s] || s;
    statusDot.className = 'status-dot ' + s;
    statusRing.className = 'avatar-status-ring ' + s;

    if (profile.listening_to_spotify && profile.spotify && spotifyCard) {
      const sp = profile.spotify;
      spotifyCard.classList.remove('hidden');
      activitySec.classList.remove('hidden');

      const albumArt = spotifyCard.querySelector('.activity-icon');
      const trackName = spotifyCard.querySelector('.activity-name');
      const artists = spotifyCard.querySelector('.activity-detail');
      const fill = spotifyCard.querySelector('.spotify-progress-fill');
      const elapsed = spotifyCard.querySelector('.elapsed');
      const duration = spotifyCard.querySelector('.duration');

      if (sp.album_art_url) albumArt.src = sp.album_art_url;
      trackName.textContent = sp.song;
      artists.textContent = sp.artist;

      const total = sp.timestamps.end - sp.timestamps.start;
      const now = Date.now() - sp.timestamps.start;
      const pct = Math.min(100, (now / total) * 100);
      fill.style.width = pct + '%';

      const fmt = ms => {
        const s = Math.floor(ms / 1000);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      };
      elapsed.textContent = fmt(Math.min(now, total));
      duration.textContent = fmt(total);

      setInterval(() => {
        const n2 = Date.now() - sp.timestamps.start;
        fill.style.width = Math.min(100, (n2 / total) * 100) + '%';
        elapsed.textContent = fmt(Math.min(n2, total));
      }, 1000);
    }

    const activities = (profile.activities || []).filter(a => a.type !== 2); /* 2 = Spotify */
    if (activities.length > 0 && activityCard) {
      const act = activities[0];
      activitySec.classList.remove('hidden');
      activityCard.classList.remove('hidden');

      const typeLabels = { 0: 'Playing', 1: 'Streaming', 3: 'Watching', 5: 'Competing in' };
      activityCard.querySelector('.activity-type').textContent = typeLabels[act.type] || 'Activity';
      activityCard.querySelector('.activity-name').textContent = act.name || '';
      activityCard.querySelector('.activity-detail').textContent = act.details || act.state || '';

      if (act.assets?.large_image) {
        const img = activityCard.querySelector('.activity-icon');
        const appId = act.application_id;
        if (act.assets.large_image.startsWith('mp:')) {
          img.src = 'https://media.discordapp.net/' + act.assets.large_image.replace('mp:', '');
        } else if (appId) {
          img.src = `https://cdn.discordapp.com/app-assets/${appId}/${act.assets.large_image}.png`;
        }
      }
    }

  } catch (_) {
    /* silently stay on fallback */
  }
})();
