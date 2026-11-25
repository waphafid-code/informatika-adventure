import { test, expect, BrowserContext, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Clean test DB before suite
const testDb = path.resolve(process.cwd(), 'data/test-informatika.db');
if (fs.existsSync(testDb)) {
  try {
    fs.unlinkSync(testDb);
  } catch {
    // ignore if locked
  }
}

async function joinStudentViaUI(
  page: Page,
  classId: string,
  studentIndexInSelect: number
): Promise<{ teamNumber: 1 | 2; isCaptain: boolean; studentName: string }> {
  await page.goto('/join');
  await page.getByTestId(`pick-class-${classId}`).click();

  const nameSelect = page.getByTestId('select-student-name');
  await expect(nameSelect).toBeVisible();
  const options = await nameSelect.locator('option').all();
  const targetOption = options[studentIndexInSelect];
  const value = await targetOption.getAttribute('value');
  const studentName = (await targetOption.textContent()) || '';
  await nameSelect.selectOption(value!);

  await page.getByTestId('to-confirm-btn').click();
  await page.getByTestId('confirm-join-btn').click();

  // Gacha
  await page.getByTestId('run-gacha-btn').click();
  await expect(page.getByTestId('gacha-result-card')).toBeVisible({ timeout: 10_000 });
  const teamText = (await page.getByTestId('assigned-team-label').textContent()) || '';
  const teamNumber: 1 | 2 = teamText.includes('1') ? 1 : 2;
  const isCaptain = await page.locator('text=Anda Ditunjuk sebagai Kapten').isVisible();

  await page.getByTestId('go-to-lobby-btn').click();
  await expect(page.getByTestId('student-lobby-view')).toBeVisible();

  return { teamNumber, isCaptain, studentName };
}

test.describe('Multi-Device Classroom Game E2E', () => {
  test('Full classroom flow: teacher + 6 concurrent students, atomic gacha, refresh, security, turn locks, reconnect, finish', async ({
    browser,
    request,
  }) => {
    // 1. Teacher context (Laptop 1366x768)
    const teacherCtx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const teacherPage = await teacherCtx.newPage();

    await teacherPage.goto('/');
    await teacherPage.screenshot({
      path: 'C:/Users/hafid/.gemini/antigravity/brain/271ccfa2-92d6-43f9-9d5c-001c7f954620/scratch/ui_home.png',
    });

    // Click Dashboard Guru button in sidebar
    await teacherPage.getByTestId('sidebar-teacher-btn').click();
    await expect(teacherPage.getByTestId('teacher-pin-input')).toBeVisible();
    await expect(teacherPage.getByTestId('teacher-biometric-btn')).toBeVisible();

    // Wrong PIN rejected
    await teacherPage.getByTestId('teacher-pin-input').fill('111111');
    await teacherPage.getByTestId('teacher-login-btn').click();
    await expect(teacherPage.locator('text=PIN Guru salah')).toBeVisible();

    // Correct PIN 020305 succeeds
    await teacherPage.getByTestId('teacher-pin-input').fill('020305');
    await teacherPage.getByTestId('teacher-login-btn').click();
    await expect(teacherPage.getByTestId('toggle-lock-cls-xi-f8')).toBeVisible();

    // Unlock Kelas XI F-8 (Buka Kunci)
    await teacherPage.getByTestId('toggle-lock-cls-xi-f8').click();
    await expect(teacherPage.getByTestId('toggle-lock-cls-xi-f8')).toContainText('Kunci Kelas');
    await teacherPage.getByTestId('toggle-sidebar-btn').click();
    await expect(teacherPage.getByTestId('toggle-sidebar-btn')).toContainText('Buka Panel');
    await teacherPage.getByTestId('toggle-sidebar-btn').click();
    await expect(teacherPage.getByTestId('toggle-sidebar-btn')).toContainText('Tutup Panel');

    // 2. Spawn 6 student mobile contexts concurrently (360px mobile width check)
    const studentContexts: BrowserContext[] = [];
    const studentPages: Page[] = [];
    for (let i = 0; i < 6; i++) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
      studentContexts.push(ctx);
      studentPages.push(await ctx.newPage());
    }

    // Verify locked class XI F-9 is disabled on student phone
    await studentPages[0].goto('/join');
    await expect(studentPages[0].getByTestId('pick-class-cls-xi-f9')).toBeDisabled();

    // Concurrent join & Gacha on unlocked XI F-8 (no token input required!)
    const joinedStudents = await Promise.all(
      studentPages.map((p, idx) => joinStudentViaUI(p, 'cls-xi-f8', idx + 1))
    );

    // Verify balanced teams: 3 vs 3
    const team1Students = joinedStudents
      .map((s, idx) => ({ ...s, idx, page: studentPages[idx], ctx: studentContexts[idx] }))
      .filter((s) => s.teamNumber === 1);
    const team2Students = joinedStudents
      .map((s, idx) => ({ ...s, idx, page: studentPages[idx], ctx: studentContexts[idx] }))
      .filter((s) => s.teamNumber === 2);

    expect(Math.abs(team1Students.length - team2Students.length)).toBeLessThanOrEqual(1);
    expect(team1Students.length).toBe(3);
    expect(team2Students.length).toBe(3);

    // Verify teacher lobby updated in realtime without refresh
    await teacherPage.getByRole('button', { name: /Lobby Tim/i }).click();
    await teacherPage.screenshot({
      path: 'C:/Users/hafid/.gemini/antigravity/brain/271ccfa2-92d6-43f9-9d5c-001c7f954620/scratch/ui_teacher_lobby.png',
    });
    await expect(teacherPage.getByTestId('teacher-team-1-list')).toContainText('3 siswa');
    await expect(teacherPage.getByTestId('teacher-team-2-list')).toContainText('3 siswa');

    // 3. Duplicate identity prevention (same student cannot join again from another device)
    const dupCtx = await browser.newContext();
    const dupPage = await dupCtx.newPage();
    await dupPage.goto('/join');
    await dupPage.getByTestId('pick-class-cls-xi-f8').click();
    const firstOptVal = await dupPage.getByTestId('select-student-name').locator('option').nth(1).getAttribute('value');
    await dupPage.getByTestId('select-student-name').selectOption(firstOptVal!);
    await dupPage.getByTestId('to-confirm-btn').click();
    await dupPage.getByTestId('confirm-join-btn').click();
    await expect(dupPage.getByTestId('join-error')).toContainText('sudah bergabung');
    await dupCtx.close();

    // 4. Refresh HP does NOT change team
    const sampleStudent = team1Students[0];
    await sampleStudent.page.reload();
    await expect(sampleStudent.page.getByTestId('student-team-badge')).toContainText('Kelompok 1');

    // 5. Cross-session isolation check via API
    const t1Token = await sampleStudent.page.evaluate(() => sessionStorage.getItem('student_token'));
    const t1SessionId = await sampleStudent.page.evaluate(() => sessionStorage.getItem('student_session_id'));
    const crossRes = await request.get(`/api/sessions/00000000-0000-0000-0000-000000000000/me`, {
      headers: { Authorization: `Bearer ${t1Token}` },
    });
    expect(crossRes.status()).toBe(403);

    // 6. Teacher starts game -> all student phones receive PLAYING state in realtime
    await teacherPage.getByRole('button', { name: /Mulai Permainan/i }).click();
    await expect(teacherPage.getByTestId('active-team-label')).toContainText('Kelompok 1');
    await teacherPage.screenshot({
      path: 'C:/Users/hafid/.gemini/antigravity/brain/271ccfa2-92d6-43f9-9d5c-001c7f954620/scratch/ui_teacher_board.png',
    });

    for (const p of studentPages) {
      await expect(p.getByTestId('student-playing-view')).toBeVisible();
    }

    // Team 1 sees active panel, Team 2 sees waiting screen
    await expect(team1Students[0].page.getByTestId('active-team-panel')).toBeVisible();
    await expect(team2Students[0].page.getByTestId('waiting-other-team')).toBeVisible();

    // 7. Teacher rolls dice for Team 1
    await teacherPage.getByTestId('roll-dice-btn').click();

    const team1Captain = team1Students.find((s) => s.isCaptain)!;
    const team1Member = team1Students.find((s) => !s.isCaptain)!;
    expect(team1Captain).toBeTruthy();
    expect(team1Member).toBeTruthy();

    await expect(team1Captain.page.getByTestId('question-text')).toBeVisible();
    // Verify no horizontal overflow on 360px mobile and 1366px desktop
    const mobileOverflow = await team1Captain.page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);
    const desktopOverflow = await teacherPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desktopOverflow).toBe(false);

    await team1Captain.page.screenshot({
      path: 'C:/Users/hafid/.gemini/antigravity/brain/271ccfa2-92d6-43f9-9d5c-001c7f954620/scratch/ui_student_question.png',
    });
    await teacherPage.screenshot({
      path: 'C:/Users/hafid/.gemini/antigravity/brain/271ccfa2-92d6-43f9-9d5c-001c7f954620/scratch/ui_teacher_question_modal.png',
    });

    // Team 2 cannot submit answer when not their turn (API check)
    const t2Token = await team2Students[0].page.evaluate(() => sessionStorage.getItem('student_token'));
    const wrongTurnRes = await request.post(`/api/sessions/${t1SessionId}/submit-answer`, {
      headers: { Authorization: `Bearer ${t2Token}` },
      data: { option: 'A' },
    });
    expect(wrongTurnRes.status()).toBe(403);

    // Non-captain Team 1 member proposes B, cannot submit final
    await team1Member.page.getByTestId('option-btn-B').click();
    await expect(team1Member.page.getByTestId('submit-final-btn')).toHaveCount(0);

    // Captain sees proposal and submits final answer A
    await team1Captain.page.getByTestId('option-btn-A').click();
    await team1Captain.page.getByTestId('submit-final-btn').click();
    await expect(team1Captain.page.getByTestId('answer-result-card')).toBeVisible();

    // Double submit prevention via API
    const t1CapToken = await team1Captain.page.evaluate(() => sessionStorage.getItem('student_token'));
    const doubleSubmitRes = await request.post(`/api/sessions/${t1SessionId}/submit-answer`, {
      headers: { Authorization: `Bearer ${t1CapToken}` },
      data: { option: 'B' },
    });
    expect(doubleSubmitRes.status()).toBe(409);

    // 8. Disconnect & Reconnect test on a student context
    await team2Students[0].ctx.setOffline(true);
    // Teacher advances to Team 2's turn while student is offline
    await teacherPage.getByTestId('next-turn-btn').click();
    await expect(teacherPage.getByTestId('active-team-label')).toContainText('Kelompok 2');

    // Reconnect student
    await team2Students[0].ctx.setOffline(false);
    await expect(team2Students[0].page.getByTestId('active-team-panel')).toBeVisible({ timeout: 15_000 });

    // 9. End game & verify consistent results across teacher & all student devices
    await teacherPage.getByTestId('end-game-btn').click();
    await expect(teacherPage.getByTestId('teacher-game-result')).toBeVisible();
    const teacherResultText = await teacherPage.getByTestId('teacher-game-result').textContent();

    for (const p of studentPages) {
      await expect(p.getByTestId('student-game-result')).toBeVisible();
      const studentResultText = await p.getByTestId('student-game-result').textContent();
      // Both show consistent winner/positions
      if (teacherResultText?.includes('Seri')) {
        expect(studentResultText).toContain('Seri');
      } else if (teacherResultText?.includes('Kelompok 1')) {
        expect(studentResultText).toContain('Kelompok 1');
      } else {
        expect(studentResultText).toContain('Kelompok 2');
      }
    }

    // Cleanup
    await teacherCtx.close();
    for (const ctx of studentContexts) {
      await ctx.close();
    }
  });

  test('Teacher solo Demo Mode: seed 6 demo students, start game smoothly, roll dice, and submit demo answer', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    await page.goto('/teacher');
    await page.getByTestId('teacher-pin-input').fill('020305');
    await page.getByTestId('teacher-login-btn').click();
    await expect(page.getByTestId('seed-demo-btn')).toBeVisible();

    await page.getByTestId('seed-demo-btn').click();
    await expect(page.getByTestId('teacher-team-1-list')).toContainText('3 siswa');
    await expect(page.getByTestId('teacher-team-2-list')).toContainText('3 siswa');

    await page.getByRole('button', { name: /Mulai Permainan/i }).click();
    await expect(page.getByTestId('active-team-label')).toContainText('Kelompok 1');

    await page.getByTestId('roll-dice-btn').click();
    await expect(page.getByTestId('teacher-question-modal')).toBeVisible();

    await page.getByTestId('demo-answer-A').click();
    await expect(page.getByTestId('next-turn-btn')).toBeVisible();
    await page.getByTestId('next-turn-btn').click();
    await expect(page.getByTestId('active-team-label')).toContainText('Kelompok 2');

    await ctx.close();
  });
});
