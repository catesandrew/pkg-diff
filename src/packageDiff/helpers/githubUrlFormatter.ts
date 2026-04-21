export class GithubUrlFormatter {
  private static readonly PATTERN =
    /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:pull|issues)\/(\d+)/g

  static toTerminalLink(text: string): string {
    return text.replace(GithubUrlFormatter.PATTERN, '#$1')
  }

  static toMarkdownLink(text: string): string {
    return text.replace(GithubUrlFormatter.PATTERN, (match, id) => `[#${id}](${match})`)
  }

  static toShortText(text: string): string {
    return text.replace(GithubUrlFormatter.PATTERN, '#$1')
  }
}
