const getRefId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  if (typeof value.toString === "function") return String(value.toString());
  return null;
};

const parseScorePair = (scoreText = "") => {
  const text = String(scoreText || "").trim();
  const match = text.match(/(-?\d+)\s*[-:]\s*(-?\d+)/);
  if (!match) return null;
  return { a: Number(match[1]), b: Number(match[2]) };
};

const ensureRow = (table, key, rowData) => {
  if (!table.has(key)) {
    table.set(key, {
      entityType: rowData.entityType,
      entity: rowData.entity,
      name: rowData.name || "",
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      points: 0,
      lastUpdatedAt: new Date(),
    });
  }
  return table.get(key);
};

export const recalculateEventStandings = (event) => {
  const rows = new Map();
  const rounds = Array.isArray(event?.schedule) ? event.schedule : [];
  const isTeamFormat = event?.gameFormat === "team";

  for (const round of rounds) {
    const matches = Array.isArray(round?.matches) ? round.matches : [];
    for (const match of matches) {
      if (match?.result?.status !== "completed") continue;

      const sideAId = isTeamFormat ? getRefId(match.team1) : getRefId(match.player1);
      const sideBId = isTeamFormat ? getRefId(match.team2) : getRefId(match.player2);
      if (!sideAId || !sideBId) continue;

      const sideAName = isTeamFormat
        ? match?.team1?.name || ""
        : [match?.player1?.firstName, match?.player1?.lastName].filter(Boolean).join(" ");
      const sideBName = isTeamFormat
        ? match?.team2?.name || ""
        : [match?.player2?.firstName, match?.player2?.lastName].filter(Boolean).join(" ");

      const rowA = ensureRow(rows, sideAId, {
        entityType: isTeamFormat ? "team" : "player",
        entity: sideAId,
        name: sideAName,
      });
      const rowB = ensureRow(rows, sideBId, {
        entityType: isTeamFormat ? "team" : "player",
        entity: sideBId,
        name: sideBName,
      });

      rowA.played += 1;
      rowB.played += 1;

      const winnerId = getRefId(match?.result?.winner);
      if (winnerId === sideAId) {
        rowA.won += 1;
        rowA.points += 3;
        rowB.lost += 1;
      } else if (winnerId === sideBId) {
        rowB.won += 1;
        rowB.points += 3;
        rowA.lost += 1;
      } else {
        rowA.drawn += 1;
        rowB.drawn += 1;
        rowA.points += 1;
        rowB.points += 1;
      }

      const parsed = parseScorePair(match?.result?.score || "");
      if (parsed) {
        rowA.pointsFor += parsed.a;
        rowA.pointsAgainst += parsed.b;
        rowB.pointsFor += parsed.b;
        rowB.pointsAgainst += parsed.a;
      }
    }
  }

  const standings = [...rows.values()].map((row) => ({
    ...row,
    pointDiff: row.pointsFor - row.pointsAgainst,
    lastUpdatedAt: new Date(),
  }));

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return (a.name || "").localeCompare(b.name || "");
  });

  return standings.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
};
