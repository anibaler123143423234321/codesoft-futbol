// Real ESPN clock and event sync
export function getOfficialMatchStatus(match) {
  return {
    isLive: match?.status === 'live',
    isFinished: match?.status === 'finished',
    minute: match?.minute || 'Hoy'
  };
}
