const SOCIAL_PREVIEW_CRAWLER_PATTERN =
  /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|linkedinbot|slackbot|discordbot|skypeuripreview/i;

export function isSocialPreviewCrawler(userAgent: string | null | undefined) {
  return Boolean(userAgent && SOCIAL_PREVIEW_CRAWLER_PATTERN.test(userAgent));
}
