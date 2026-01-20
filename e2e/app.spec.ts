import { test, expect } from '@playwright/test';

test('la app carga correctamente', async ({ page }) => {
  try {
    await page.goto('/');
  } catch (error) {
    console.error('❌ No se pudo conectar con la app. ¿Está corriendo en http://localhost:4200?');
    throw error;
  }

  try {
    await expect(page).toHaveTitle(/NPH/i);
    console.log('✅ Título verificado correctamente');
  } catch (error) {
    console.error('❌ Error: el título no es el esperado');
    throw error;
  }

  try {
    await expect(page.locator('text=¡Bienvenido!')).toBeVisible({ timeout: 10000 });
    console.log('✅ Texto de bienvenida visible');
  } catch (error) {
    console.error('❌ Error: el texto "¡Bienvenido!" no está visible');
    throw error;
  }
});
