import { Client } from "@notionhq/client";
import { GetStaticProps, NextPage } from "next";
import styles from "../styles/Home.module.css";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useEffect } from "react";
import prism from "prismjs";
import {
  DatabaseObjectResponse,
  PageObjectResponse,
  PartialDatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export type Content =
  | {
      type: "paragraph" | "quote" | "heading_2" | "heading_3";
      text: string | null;
    }
  | {
      type: "code";
      text: string | null;
      language: string | null;
    };

export type Post = {
  id: string;
  title: string | null;
  slug: string | null;
  createdTs: string | null;
  lastEditedTs: string | null;
  contents: Content[];
};

type StaticProps = {
  posts: Post[] | null;
};

export const getStaticProps: GetStaticProps<StaticProps> = async () => {
  const posts = await getPosts();
  const contentsList = await Promise.all(
    posts.map((post) => {
      return getPostContents(post);
    })
  );
  posts.forEach((post, index) => {
    post.contents = contentsList[index];
  });
  return {
    props: { posts },
    revalidate: 60,
  };
};

const getTitle = (
  page:
    | PageObjectResponse
    | PartialDatabaseObjectResponse
    | DatabaseObjectResponse
): string | null => {
  let title: string | null = null;
  if (page.properties["Name"]?.type === "title") {
    title = page.properties["Name"].title[0]?.plain_text ?? null;
  }
  return title;
};

const getSlug = (
  page:
    | PageObjectResponse
    | PartialDatabaseObjectResponse
    | DatabaseObjectResponse
): string | null => {
  let slug: string | null = null;
  if (page.properties["Slug"]?.type === "rich_text") {
    slug = page.properties["Slug"].rich_text[0]?.plain_text ?? null;
  }
  return slug;
};

const getPosts = async () => {
  const database = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID || "",
    filter: {
      and: [
        {
          property: "document",
          checkbox: {
            equals: true,
          },
        },
      ],
    },
    sorts: [
      {
        timestamp: "created_time",
        direction: "descending",
      },
    ],
  });

  const posts: Post[] = [];
  for (const page of database.results) {
    if ("properties" in page) {
      const title = getTitle(page);
      const slug = getSlug(page);
      const post: Post = {
        id: page.id,
        title, // keyとvalueが一緒なのでこれでOK
        slug,
        createdTs: page.created_time,
        lastEditedTs: page.last_edited_time,
        contents: [],
      };
      posts.push(post);
    }
  }
  return posts;
};

const getPostContents = async (post: Post) => {
  const blocks = await notion.blocks.children.list({
    block_id: post.id,
  });

  const contents: Content[] = [];
  blocks.results.forEach((block) => {
    if (!("type" in block)) {
      return "";
    }
    switch (block.type) {
      case "paragraph":
        contents.push({
          type: "paragraph",
          text: block.paragraph.rich_text[0]?.plain_text ?? null,
        });
        break;
      case "heading_2":
        contents.push({
          type: "heading_2",
          text: block.heading_2.rich_text[0]?.plain_text ?? null,
        });
      case "quote":
        contents.push({
          type: "quote",
          text: block.quote.rich_text[0]?.plain_text ?? null,
        });
      case "code":
        contents.push({
          type: "code",
          text: block.code.rich_text[0]?.plain_text ?? null,
          language: block.code.language,
        });
    }
  });
  return contents;
};

const Home: NextPage<StaticProps> = ({ posts }) => {
  if (!posts) {
    return null;
  }

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.post}>
          <h1 className={styles.title}>{post?.title}</h1>
          <div className={styles.timestampWrapper}>
            <div>
              <div className={styles.timestamp}>
                作成日時:{" "}
                {dayjs(post.createdTs).tz().format("YYYY-MM-DD HH:mm:ss")}
              </div>
              <div className={styles.timestamp}>
                更新日時:{" "}
                {dayjs(post.lastEditedTs).tz().format("YYYY-MM-DD HH:mm:ss")}
              </div>
            </div>
          </div>
          {post.contents.map((content: Content, index: number) => {
            const key = `${post.id}_${index}`;
            switch (content.type) {
              case "heading_2":
                return (
                  <h2 key={key} className={styles.heading2}>
                    {content.text}
                  </h2>
                );
              case "heading_3":
                return (
                  <h3 key={key} className={styles.heading3}>
                    {content.text}
                  </h3>
                );
              case "paragraph":
                return (
                  <p key={key} className={styles.paragraph}>
                    {content.text}
                  </p>
                );
              case "code":
                return (
                  <pre
                    key={key}
                    className={`
                              ${styles.code}
                              lang-${content.language} 
                          `}
                  >
                    <code>{content.text}</code>
                  </pre>
                );
              case "quote":
                return (
                  <blockquote key={key} className={styles.quote}>
                    {content.text}
                  </blockquote>
                );
            }
          })}
        </div>
      </div>
    </>
  );
};

export default Home;
