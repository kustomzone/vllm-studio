import { test, expect } from "@playwright/test";

test("projects workflow with documents and chat", async ({ page, request }) => {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const apiBaseUrl = `${baseUrl}/api/proxy`;
  const projectName = `E2E Project ${Date.now()}`;
  const documentName = `e2e-${Date.now()}.txt`;

  let configResponse;
  try {
    configResponse = await request.get(`${apiBaseUrl}/config`);
  } catch (error) {
    test.skip(true, "Backend /config not reachable. Start controller with Projects enabled.");
    return;
  }
  if (!configResponse.ok()) {
    test.skip(true, "Backend /config not reachable. Start controller with Projects enabled.");
    return;
  }
  const config = (await configResponse.json()) as {
    config?: { enable_projects?: boolean };
  };
  if (!config.config?.enable_projects) {
    test.skip(true, "Projects feature flag disabled. Set VLLM_STUDIO_ENABLE_PROJECTS=true.");
  }

  await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });

  await page.getByTestId("project-create-open").click();
  await page.getByTestId("project-create-name").fill(projectName);
  await page.getByTestId("project-create-submit").click();
  await expect(page.getByText(projectName)).toBeVisible();

  const projectsResponse = await request.get(`${apiBaseUrl}/projects`);
  expect(projectsResponse.ok()).toBe(true);
  const projectsPayload = (await projectsResponse.json()) as {
    projects: Array<{ id: string; name: string }>;
  };
  const project = projectsPayload.projects.find((item) => item.name === projectName);
  if (!project) {
    throw new Error("Project was not created");
  }

  const projectId = project.id;

  try {
    await page.goto(`${baseUrl}/projects/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("project-tab-panel-documents")).toBeVisible();

    await page.getByTestId("project-document-upload-file").setInputFiles({
      name: documentName,
      mimeType: "text/plain",
      buffer: Buffer.from("Project E2E document"),
    });
    await page.getByTestId("project-document-upload-submit").click();

    const documentRow = page.locator("tr", { hasText: documentName });
    await expect(documentRow).toContainText("Ready");

    await page.goto(`${baseUrl}/chat?project_id=${projectId}`, {
      waitUntil: "domcontentloaded",
    });

    const projectSelect = page.getByTestId("chat-project-select");
    await expect(projectSelect).toHaveValue(projectId);
    await expect(projectSelect.locator("option:checked")).toHaveText(projectName);
  } finally {
    await request.delete(`${apiBaseUrl}/projects/${projectId}`);
  }
});
