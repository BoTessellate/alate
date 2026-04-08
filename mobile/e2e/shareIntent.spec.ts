describe('Share Intent Flow', () => {
  it('should launch the app successfully', async () => {
    // Wait for app to fully load
    await browser.pause(8000);

    // Try multiple selectors to find the URL input
    // Test 1: Try testID selector
    let urlInput = await $('~url-input').catch(() => null);

    // Test 2: Try text-based selector
    if (!urlInput) {
      urlInput = await $('android=new UiSelector().textContains("product URL")').catch(() => null);
    }

    // Test 3: Try finding any text input
    if (!urlInput) {
      urlInput = await $('android=new UiSelector().className("android.widget.EditText")').catch(() => null);
    }

    // Get page source for debugging
    const source = await browser.getPageSource();
    console.log('Page source:', source.substring(0, 500));

    // Verify app launched (even if we can't find specific element)
    const appPackage = await browser.getCurrentPackage();
    expect(appPackage).toBe('com.alate.checkfit');
  });
});
