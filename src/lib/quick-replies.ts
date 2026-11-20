/** Conservative shortcuts for the question actually asked, never treatment choices. */
export function quickRepliesFor(question: string | undefined): string[] {
  const q = (question || "").trim().toLowerCase();
  // Multi-part questions need prose, otherwise one tap could answer the wrong part.
  if (
    !q ||
    q.split("?").filter((part) => part.trim()).length > 1 ||
    /\b(?:or|and)\b|,|\bscale\b/.test(q)
  )
    return [];
  if (/^how much .*affecting .*activities\??$/.test(q))
    return ["Not much", "Slowing me down", "Can’t do them", "Not sure"];
  if (/how (?:severe|bad|painful)|rate (?:the|your) pain|severity/.test(q))
    return ["Mild", "Moderate", "Severe", "Not sure"];
  if (/how long|for how many/.test(q))
    return ["Less than a day", "1–3 days", "More than 3 days", "Not sure"];
  if (/when did .*start|when did .*begin|when .*started|when .*began/.test(q))
    return ["Today", "Yesterday", "A few days ago", "Not sure"];
  if (
    /^(?:have|has|do|does|did|is|are|was|were|can|any)\b/.test(q) &&
    !/\b(?:what|when|where|which|how)\b/.test(q)
  )
    return ["Yes", "No", "Not sure"];
  return [];
}
