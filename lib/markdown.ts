import type { Options as ReactMarkdownOptions } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
  strip: [...(defaultSchema.strip || []), "iframe", "object", "style", "form"],
};

export const markdownRemarkPlugins: ReactMarkdownOptions["remarkPlugins"] = [
  // singleTilde:false requires `~~double~~` tildes for strikethrough. A single
  // `~` is the standard CJK notation for numeric ranges ("5~7U", "100~200倍");
  // GFM would otherwise silently strike the span through and drop the tilde.
  [remarkGfm, { singleTilde: false }],
  remarkMath,
];
export const markdownPreviewRemarkPlugins: ReactMarkdownOptions["remarkPlugins"] = [
  [remarkGfm, { singleTilde: false }],
];

export const markdownRehypePlugins: ReactMarkdownOptions["rehypePlugins"] = [
  rehypeRaw,
  [rehypeSanitize, markdownSanitizeSchema],
  [rehypeKatex, { throwOnError: false, strict: false }],
];

export const markdownPreviewRehypePlugins: ReactMarkdownOptions["rehypePlugins"] = [
  rehypeRaw,
  [rehypeSanitize, markdownSanitizeSchema],
];
