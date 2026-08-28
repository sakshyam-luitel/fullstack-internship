import { useEffect, useState } from "react";
import { getPosts, deletePost, updatePosts, createPost } from "../api/posts";

function Posts() {
  const [posts, setPosts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newPost, setNewPost] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function loadPosts() {
      const data = await getPosts();
      setPosts(data);
    }

    loadPosts();
  }, []);

  return (
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
          <button
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 active:bg-teal-900"
            onClick={() => {
              setNewPost(true);
            }}
          >
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

        {newPost && (
          <>
            {/* Create form (shown when the "New post" button has been pressed) */}
            <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50/50 p-5 shadow-sm">
              <input
                type="text"
                placeholder="Post title"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
              <textarea
                placeholder="Write something..."
                rows={3}
                className="mt-3 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-200"
                  onClick={() => {
                    setNewPost(false);
                  }}
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
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  className="flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800"
                  onClick={async () => {
                    const newPost = await createPost(title, description);
                    console.log("newPost:", newPost); // <-- check this in the console
                    if (newPost) {
                      setPosts((prev) => [newPost, ...prev]);
                    }
                    setNewPost(false);
                  }}
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
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Save
                </button>
              </div>
            </div>
          </>
        )}

        {/* Post list */}
        <ul className="space-y-4">
          {/* --- Post card: normal / editing state --- */}
          {posts.map((post) => {
            const isEditing = editingId === post.id;

            return (
              <li
                key={post.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      defaultValue={post.title}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-base font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      onChange={(event) => {
                        setTitle(event.target.value);
                      }}
                    />
                    <textarea
                      defaultValue={post.content}
                      rows={3}
                      className="mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      onChange={(event) => {
                        setDescription(event.target.value);
                      }}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
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
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await updatePosts(post.id, title, description);
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.id === post.id
                                ? { ...p, title, content: description }
                                : p,
                            ),
                          );
                          setEditingId(null);
                        }}
                        className="flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800"
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
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold text-slate-900">
                        {post.title}
                      </h2>
                      <div className="flex shrink-0 gap-1">
                        <button
                          aria-label="Edit post"
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
                          onClick={() => setEditingId(post.id)}
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
                          onClick={async () => {
                            await deletePost(post.id);
                            setPosts((prev) =>
                              prev.filter((p) => p.id !== post.id),
                            );
                          }}
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default Posts;
