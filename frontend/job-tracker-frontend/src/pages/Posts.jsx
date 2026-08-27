import { useEffect, useState } from "react";
import { getPosts, deletePost } from "../api/posts";

function Posts() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    async function loadPosts() {
      const data = await getPosts();
      setPosts(data);
    }

    loadPosts();
  }, []);

  return (
    // <div>
    //   {posts.map((post) => (
    //     <div key={post.id}>
    //       <h1>{post.title}</h1>
    //       <p>{post.content}</p>
    //     </div>
    //   ))}
    // </div>

    //     export default function PostBoard() {
    //   return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="mb-8 flex items-end justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Posts
            </h1>
            <p className="mt-1 text-sm text-slate-500">3 posts</p>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 active:bg-teal-900">
            {/* Plus icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New post
          </button>
        </header>

        {/* Create form (shown when the "New post" button has been pressed) */}
        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50/50 p-5 shadow-sm">
          <input
            type="text"
            placeholder="Post title"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
          <textarea
            placeholder="Write something..."
            rows={3}
            className="mt-3 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              Cancel
            </button>
            <button className="flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Save
            </button>
          </div>
        </div>

        {/* Post list */}
        <ul className="space-y-4">
          {/* --- Post card: normal (view) state --- */}
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Welcome to your board
              </h2>
              <div className="flex shrink-0 gap-1">
                <button
                  aria-label="Edit post"
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  aria-label="Delete post"
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              This is your first post. Use the pencil icon to edit it, the trash
              icon to remove it, or the plus button above to add a new one.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Aug 27, 2026
            </p>
          </li>

          {/* --- Post card: editing state --- */}
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <input
              type="text"
              defaultValue="Weekend trip notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <textarea
              defaultValue="Pack hiking boots, check the weather, book the campsite."
              rows={3}
              className="mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                Cancel
              </button>
              <button className="flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Save
              </button>
            </div>
          </li>

          {/* --- Post card: normal (view) state --- */}
          {posts.map((post) => {
            return (
              <li
                key={post.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    {post.title}
                  </h2>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label="Edit post"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      aria-label="Delete post"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => {deletePost(post.id)}}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {post.content}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {post.createdAt}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
//   );
// }

export default Posts;
