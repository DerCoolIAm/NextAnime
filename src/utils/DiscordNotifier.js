// DiscordNotifier.js
export async function notifyDiscordBot(message, imageUrl = null) {
  try {
    const payload = {
      channelId: '1398663361159368857',
      title: message,
      imageUrl,
    };

    await fetch('http://localhost:3000/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`Discord notified about: ${message}`);
  } catch (err) {
    console.error('Failed to notify Discord:', err);
  }
}
