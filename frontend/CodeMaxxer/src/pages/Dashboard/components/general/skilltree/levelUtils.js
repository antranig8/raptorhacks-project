export function calculateLevelData(totalXp) {
    let currentLevel = 1;
    let xpAccumulated = 0;
    let currentLevelReq = 100;

    // While total XP is enough to pass the current level...
    while (totalXp >= xpAccumulated + currentLevelReq) {
        xpAccumulated += currentLevelReq;
        currentLevel++;
        // Formula: round((PrevThreshold * 1.5) / 25) * 25
        currentLevelReq = Math.round((currentLevelReq * 1.5) / 25) * 25;
    }

    const xpInCurrentLevel = totalXp - xpAccumulated;
    const progressPercentage = Math.min(Math.max(xpInCurrentLevel / currentLevelReq, 0), 1);

    return {
        currentLevel,
        xpInCurrentLevel,
        xpRequiredForNextLevel: currentLevelReq,
        progressPercentage
    };
}
