// DiscordNotifier.js
export async function notifyDiscordBot(title) {
  try {
    await fetch('https://your-discloud-app-url/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        channelId: '1398663361159368857',
      }),
    });
    console.log(`Discord notified about: ${title}`);
  } catch (err) {
    console.error('Failed to notify Discord:', err);
  }
}


"1398663361159368857"