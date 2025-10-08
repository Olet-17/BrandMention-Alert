/**
 * Simple sentiment analysis for MVP
 * In production, use a proper NLP library like compromise or natural
 */

const positiveWords = new Set([
  'good', 'great', 'awesome', 'amazing', 'excellent', 'fantastic',
  'love', 'wonderful', 'perfect', 'outstanding', 'superb', 'brilliant',
  'fantastic', 'nice', 'cool', 'impressive', 'solid', 'decent'
]);

const negativeWords = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike',
  'poor', 'worst', 'garbage', 'trash', 'useless', 'broken',
  'disappointing', 'frustrating', 'annoying', 'sucks', 'rubbish'
]);

/**
 * Analyze sentiment of text
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis result
 */
function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { sentiment: 'neutral', confidence: 0, score: 0 };
  }

  const words = text.toLowerCase().split(/\W+/);
  let positiveCount = 0;
  let negativeCount = 0;

  words.forEach(word => {
    if (positiveWords.has(word)) positiveCount++;
    if (negativeWords.has(word)) negativeCount++;
  });

  const totalRelevant = positiveCount + negativeCount;
  const score = totalRelevant > 0 ? (positiveCount - negativeCount) / totalRelevant : 0;
  
  let sentiment = 'neutral';
  let confidence = Math.abs(score);

  if (score > 0.1) {
    sentiment = 'positive';
  } else if (score < -0.1) {
    sentiment = 'negative';
  } else {
    confidence = 0.1; // Minimum confidence for neutral
  }

  return {
    sentiment,
    confidence: Math.round(confidence * 100) / 100,
    score: Math.round(score * 100) / 100,
    positiveCount,
    negativeCount
  };
}

module.exports = {
  analyzeSentiment,
  positiveWords,
  negativeWords
};