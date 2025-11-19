This document records all AI-assisted prompts used during the development of cf_ai_edge_study_coach.

All system design, architecture decisions, and implementation direction originated from me.
AI was used as a coding accelerator — to generate boilerplate, refine TypeScript/Workers syntax, and verify best practices on Cloudflare’s platform.

2025-11-14 — Project Architecture Confirmation & Planning

Purpose:
I already had the concept for an AI-assisted study coach built on Workers AI + Durable Objects. I used AI to validate that my architectural approach matched Cloudflare’s four required components (LLM, workflow/coordination, user input, memory).

Prompt:

I need your help coming up and creating this project. Cloudflare wants an AI-powered application using Workers AI, Durable Objects, and user input. I have the idea for a study assistant — help me structure the project and make sure it fits the requirements.

Summary of AI Output:

Confirmed my concept met Cloudflare's scoring criteria

Recommended an initial file structure

Provided examples of Workers AI configuration and Durable Object binding

Ensured the repo naming and documentation strategy matched assignment expectations

2025-11-14 — Implementing the Project Structure in VS Code

Purpose:
I understood the folder structure, knew where each component belonged (Worker routing, DO logic, UI assets), and wanted AI to help generate the initial TypeScript templates faster.

The goal was productivity 

Prompt:

Let's start with the config files then will review then and we can work on the files that will be on the source and public folders.

Summary of AI Output:

Generated clean configuration files (wrangler.toml, tsconfig.json, package.json)

Produced Worker scaffolding with the correct routing structure

Generated Durable Object boilerplate which I later modified

Helped assemble a minimal HTML/CSS/JS interface for testing the agent

I then integrated, edited, and debugged these generated parts within my own planned layout.

2025-11-15 — Debugging API Route 404

Purpose:
During testing, I identified that /api/chat returned 404 despite correct Worker routing. I suspected the DO internal URL path was mismatched, and requested AI confirmation.

Prompt:

I am getting 404 Not Found when calling /api/chat even though it's defined.
Here is the log — help me find the problem.

Summary of AI Output:

Flagged the mismatch between "https://dummy/chat/message" and the DO handler expecting "/message"

Suggested correcting the internal fetch URLs

After adjusting, routing + AI integration worked correctly

2025-11-15 — Fixing DO Migration Requirements on Free Plan

Purpose:
Deployment failed due to Cloudflare’s updated Durable Object requirements (new_sqlite_classes). I needed confirmation of the correct migration syntax.

Prompt:

Deployment failed: “you must create a namespace using new_sqlite_classes.”
What should I change?

Summary of AI Output:

Explained Cloudflare’s use of SQLite-backed DOs on the free plan

Provided corrected migration block

Deployment succeeded afterward

2025-11-14 — workers.dev Subdomain Requirement

Purpose:
The Worker required a Workers.dev subdomain before deployment could proceed. I asked AI for the quickest verification steps.

Prompt:

Deployment error: “You need a workers.dev subdomain.”
What do I do?

Summary of AI Output:

Clarified how to initialize the subdomain

Verified Wrangler login alignment

Deployment proceeded normally

