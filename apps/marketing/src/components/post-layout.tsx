import type { ReactNode } from "react";
import { formatDate, postPath, type PostMeta } from "@/lib/posts";
import { JsonLd, blogPostingLd } from "@/lib/seo";
import { FinalCta } from "./blocks";
import { Breadcrumbs } from "./breadcrumbs";

export function PostLayout({ post, children }: { post: PostMeta; children: ReactNode }) {
  const path = postPath(post.slug);
  return (
    <>
      <JsonLd
        data={blogPostingLd({
          title: post.title,
          description: post.description,
          path,
          datePublished: post.date,
        })}
      />
      <article>
        <header className="container-site pt-6 pb-10 md:pt-10">
          <Breadcrumbs
            items={[
              { name: "Blog", path: "/blog/" },
              { name: post.title, path },
            ]}
          />
          <div className="mt-10 max-w-[68ch] md:mt-14">
            <p className="eyebrow">
              <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
            </p>
            <h1 className="display h1-page">{post.title}</h1>
            <p className="lede mt-6 max-w-[60ch]">{post.description}</p>
          </div>
        </header>
        <div className="container-site pb-10">
          <div className="prose-mn">{children}</div>
        </div>
      </article>
      <FinalCta />
    </>
  );
}
