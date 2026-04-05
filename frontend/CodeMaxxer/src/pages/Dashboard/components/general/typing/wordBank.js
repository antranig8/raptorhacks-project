const WORDS = [
    'ability', 'about', 'above', 'accept', 'according', 'account', 'across', 'action', 'activity', 'actually',
    'address', 'administration', 'admit', 'adult', 'affect', 'after', 'again', 'against', 'age', 'agency',
    'agent', 'ago', 'agree', 'agreement', 'ahead', 'allow', 'almost', 'alone', 'along', 'already',
    'also', 'although', 'always', 'American', 'among', 'amount', 'analysis', 'and', 'animal', 'another',
    'answer', 'any', 'anyone', 'anything', 'appear', 'apply', 'approach', 'area', 'argue', 'around',
    'arrive', 'art', 'article', 'artist', 'as', 'ask', 'assume', 'at', 'attack', 'attention',
    'author', 'authority', 'available', 'avoid', 'away', 'baby', 'back', 'bad', 'bag', 'ball',
    'bank', 'bar', 'base', 'be', 'beat', 'beautiful', 'because', 'become', 'bed', 'before',
    'begin', 'behavior', 'behind', 'believe', 'benefit', 'best', 'better', 'between', 'beyond', 'big',
    'bill', 'billion', 'bit', 'black', 'blood', 'blue', 'board', 'body', 'book', 'born',
    'both', 'box', 'boy', 'break', 'bring', 'brother', 'budget', 'build', 'building', 'business',
    'but', 'buy', 'by', 'call', 'camera', 'campaign', 'can', 'cancer', 'candidate', 'capable',
    'capital', 'car', 'card', 'care', 'career', 'carry', 'case', 'catch', 'cause', 'cell',
    'center', 'central', 'century', 'certain', 'certainly', 'chair', 'challenge', 'chance', 'change', 'character',
    'charge', 'check', 'child', 'choice', 'choose', 'church', 'citizen', 'city', 'civil', 'claim',
    'class', 'clear', 'clearly', 'close', 'coach', 'cold', 'collection', 'college', 'color', 'come'
]

export function randomText(wordCount = 25) {
    const out = []
    for (let i = 0; i < wordCount; i++) {
        const w = WORDS[Math.floor(Math.random() * WORDS.length)]
        out.push(w)
    }
    // Capitalize first word and add a period at end sometimes
    if (out.length > 0) {
        out[0] = out[0][0].toUpperCase() + out[0].slice(1)
        if (Math.random() > 0.6) {
            out[out.length - 1] = out[out.length - 1] + '.'
        }
    }
    return out.join(' ')
}

export default {
    WORDS,
    randomText,
}
