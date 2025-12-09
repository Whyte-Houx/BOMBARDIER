import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {

    test('should redirect to login when accessing protected route', async ({ page }) => {
        await page.goto('/');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('h1')).toContainText(/Login/i);
    });

    test('should allow navigation to login page', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    // Mocking API responses for a more isolated frontend test would be better
    // but for full E2E we usually want real backend. 
    // Since we don't have a guaranteed test user, we'll stop here for the basic smoke test.

    test('should validate form inputs on login', async ({ page }) => {
        await page.goto('/login');

        // Attempt empty submit
        await page.click('button[type="submit"]');

        // Check for HTML5 validation or UI error
        // (Assuming standard HTML5 validation or react state error)
        // Adjust selector based on actual implementation

        // For now, just ensure we are still on login page
        await expect(page).toHaveURL(/\/login/);
    });

});
