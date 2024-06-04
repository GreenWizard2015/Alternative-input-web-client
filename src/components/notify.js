async function notifyServer(data) {
  const response = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    console.error("Failed to notify server:", response.statusText);
  }
}

export { notifyServer };