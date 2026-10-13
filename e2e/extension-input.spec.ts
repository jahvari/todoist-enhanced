import { test, expect, row } from './demo';
import type { Locator } from '@playwright/test';

/** Reproduce an extension setting the value, without React's native change path. */
async function replaceInput(field: Locator, corrected: string) {
  await field.evaluate((node: HTMLInputElement | HTMLTextAreaElement, next) => {
    node.value = next;
    node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: next }));
  }, corrected);
}

test('a task name keeps an extension replacement when the task is saved', async ({ demo: page }) => {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const composer = page.getByRole('dialog', { name: 'Add task' });
  const name = composer.getByRole('textbox', { name: 'Task name', exact: true });
  await name.fill('Fix teh spelling');
  // Extensions can use the element's setter and then send an input event.
  // React's onChange may miss this because its value tracker already agrees.
  await replaceInput(name, 'Fix the spelling');
  // Moving the caret re-renders the mirror. It must not restore the old draft.
  await name.press('Home');
  await expect(name).toHaveValue('Fix the spelling');
  await composer.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(row(page, 'Fix the spelling')).toBeVisible();
  await expect(row(page, 'Fix teh spelling')).toHaveCount(0);
});

test('an existing task saves an extension correction to its title', async ({ demo: page }) => {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const composer = page.getByRole('dialog', { name: 'Add task' });
  await composer.getByRole('textbox', { name: 'Task name', exact: true }).fill('Edit teh spelling');
  await composer.getByRole('button', { name: 'Add task', exact: true }).click();
  await row(page, 'Edit teh spelling').locator('.ttitle').click();
  const detail = page.locator('.overlay');
  const title = detail.getByRole('textbox', { name: 'Task', exact: true });
  await replaceInput(title, 'Edit the spelling');
  await detail.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(row(page, 'Edit the spelling')).toBeVisible();
  await expect(row(page, 'Edit teh spelling')).toHaveCount(0);
});

test('subtask inputs keep extension corrections before Enter and on blur', async ({ demo: page }) => {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const composer = page.getByRole('dialog', { name: 'Add task' });
  await composer.getByRole('textbox', { name: 'Task name', exact: true }).fill('Extension subtasks');
  const draft = composer.getByRole('textbox', { name: 'Add subtask', exact: true });
  await draft.fill('Fix teh subtask');
  await replaceInput(draft, 'Fix the subtask');
  await draft.press('Enter');
  const subtask = composer.getByRole('textbox', { name: 'Subtasks', exact: true });
  await expect(subtask).toHaveValue('Fix the subtask');
  await subtask.fill('Keep teh correction');
  await replaceInput(subtask, 'Keep the correction');
  await composer.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(row(page, 'Keep the correction')).toBeVisible();
  await expect(row(page, 'Keep teh correction')).toHaveCount(0);
});

test('a correction carries a refused shorthand range when its position changes', async ({ demo: page }) => {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const composer = page.getByRole('dialog', { name: 'Add task' });
  const name = composer.getByRole('textbox', { name: 'Task name', exact: true });
  await name.fill('Fix speling p1');
  await name.press('End');
  // The first Backspace refuses the priority reading and keeps the text.
  await name.press('Backspace');
  await expect(name).toHaveValue('Fix speling p1');
  await expect(composer.locator('.namemirror .nmark.priority')).toHaveCount(0);
  await replaceInput(name, 'Fix spelling p1');
  await expect(composer.locator('.namemirror .nmark.priority')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(row(page, 'Fix spelling p1')).toBeVisible();
});

test('a description keeps an extension replacement when the task is saved', async ({ demo: page }) => {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const composer = page.getByRole('dialog', { name: 'Add task' });
  await composer.getByRole('textbox', { name: 'Task name', exact: true }).fill('Extension description');
  const description = composer.getByRole('textbox', { name: 'Description', exact: true });
  await description.fill('Fix teh spelling');
  await description.evaluate((node) => {
    const line = node.querySelector('.cm-line')!;
    line.firstChild!.textContent = 'Fix the spelling';
    node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: 'the' }));
  });
  await expect(description).toContainText('Fix the spelling');
  await composer.getByRole('button', { name: 'Add task', exact: true }).click();
  await row(page, 'Extension description').locator('.ttitle').click();
  await expect(page.locator('.overlay .descview')).toContainText('Fix the spelling');
});
