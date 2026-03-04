# AI Co-Authors

When working with various AI coding assistants, you may want to attribute their contributions using standard Git `Co-authored-by` tags.

Below is a reference list of email addresses you can use to attribute these AI tools properly in your commit messages.

## Usage

To add a co-author to a commit, append the following format to the very end of your commit message, ensuring there is a blank line between the commit message body and the co-author tags:

```text
Co-authored-by: Name <email@domain.com>
```

---

## Reference List

### Gemini 3.1 Pro

- **Format:** `Co-authored-by: Gemini 3.1 Pro <gemini@google.com>`
- _Note: Google’s models (like Gemini) don't have a strict public GitHub email, but using their standard domain designates the attribution clearly._

### z.ai

- **Format:** `Co-authored-by: z.ai <noreply@z.ai>`
- _Note: Using a `noreply@` address is a best practice for AI agents to prevent notifications from routing to an unused inbox. Alternatively, you can use `Co-authored-by: z.ai <contact@zhipuai.cn>`._

### OpenCode

- **Format:** `Co-authored-by: OpenCode <noreply@opencode.ai>`
- _Note: OpenCode is the AI agent created by z.ai, and this is the default email it uses to attribute its own commits._

### Claude 4.6 Models

- **Claude Sonnet 4.6 Format:** `Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Claude Opus 4.6 Format:** `Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>`
- _Note: Anthropic models use the Anthropic domain for attribution._
