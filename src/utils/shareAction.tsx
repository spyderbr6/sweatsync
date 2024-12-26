export async function shareContent(title: string, text: string, url?: string) {
    const shareUrl = url || window.location.href; // Use the provided URL or fallback to the current location.
  
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        console.log('Successfully shared!');
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Clipboard write failed:', error);
        alert('Unable to copy link. Please try again.');
      }
    }
  }
  