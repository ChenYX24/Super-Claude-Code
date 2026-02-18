export interface ToolTemplate {
  name: string;
  description: string;
  category: string;
  content: string; // The actual markdown content to write
}

export const SKILL_TEMPLATES: ToolTemplate[] = [
  {
    name: "tdd-workflow",
    description: "Enforce test-driven development: write tests first, then implement",
    category: "Development",
    content: `---
name: tdd-workflow
description: Enforce test-driven development workflow
---

# TDD Workflow

## Process
1. Write failing test first (RED)
2. Write minimal code to pass (GREEN)
3. Refactor while keeping tests green (IMPROVE)
4. Verify 80%+ coverage

## Rules
- Never write implementation before tests
- One test at a time
- Small incremental steps
`,
  },
  {
    name: "code-review",
    description: "Comprehensive code review checklist for quality and security",
    category: "Quality",
    content: `---
name: code-review
description: Comprehensive code review
---

# Code Review Checklist

## Check
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Error handling is comprehensive
- [ ] No hardcoded secrets
- [ ] Input validation at boundaries
- [ ] No security vulnerabilities (XSS, injection)
`,
  },
  {
    name: "api-design",
    description: "REST API design patterns with consistent response format",
    category: "Development",
    content: `---
name: api-design
description: REST API design patterns
---

# API Design Guide

## Response Format
Always use consistent envelope: { success, data, error, metadata }

## Naming
- Use plural nouns: /users, /posts
- Use kebab-case: /user-settings
- Version in URL: /api/v1/

## Status Codes
- 200: Success, 201: Created, 204: No Content
- 400: Bad Request, 401: Unauthorized, 404: Not Found
- 500: Internal Server Error
`,
  },
  {
    name: "security-scan",
    description: "Security vulnerability detection before commits",
    category: "Security",
    content: `---
name: security-scan
description: Security vulnerability scanning
---

# Security Scan

## Before Every Commit
- [ ] No hardcoded secrets (API keys, passwords)
- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML output)
- [ ] CSRF tokens on state-changing requests
- [ ] Rate limiting on public endpoints
- [ ] Error messages don't leak internals
`,
  },
  {
    name: "docker-patterns",
    description: "Docker and Docker Compose best practices",
    category: "DevOps",
    content: `---
name: docker-patterns
description: Docker containerization patterns
---

# Docker Patterns

## Dockerfile Best Practices
- Use multi-stage builds
- Pin base image versions
- Run as non-root user
- Use .dockerignore
- Minimize layers
- Copy package files before source code

## Docker Compose
- Use named volumes for persistence
- Define health checks
- Use environment files (.env)
- Set resource limits
`,
  },
];

export const AGENT_TEMPLATES: ToolTemplate[] = [
  {
    name: "planner",
    description: "Implementation planning specialist for complex features",
    category: "Planning",
    content: `---
name: planner
description: Implementation planning specialist
model: sonnet
---

# Planner Agent

You are an expert software architect. When given a feature request:

1. Analyze requirements and identify ambiguities
2. Research the existing codebase for relevant patterns
3. Design a step-by-step implementation plan
4. Identify risks and dependencies
5. Estimate complexity and suggest phases

Always present plans in a structured format with clear acceptance criteria.
`,
  },
  {
    name: "code-reviewer",
    description: "Expert code review with security and quality focus",
    category: "Quality",
    content: `---
name: code-reviewer
description: Expert code review specialist
model: haiku
---

# Code Reviewer

Review code for:
1. **Correctness**: Logic errors, edge cases, race conditions
2. **Security**: Injection, XSS, CSRF, secrets exposure
3. **Performance**: N+1 queries, unnecessary re-renders, memory leaks
4. **Maintainability**: Naming, complexity, coupling
5. **Style**: Consistency with project conventions

Rate issues as CRITICAL, HIGH, MEDIUM, LOW.
`,
  },
  {
    name: "tdd-guide",
    description: "Test-driven development enforcer with coverage tracking",
    category: "Testing",
    content: `---
name: tdd-guide
description: TDD enforcement specialist
model: sonnet
---

# TDD Guide

Enforce strict test-driven development:

1. **RED**: Write a failing test that defines the expected behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **IMPROVE**: Refactor while keeping tests green

Rules:
- Never write code without a test first
- One behavior per test
- Test names describe the behavior being tested
- Target 80%+ code coverage
`,
  },
  {
    name: "security-reviewer",
    description: "Security vulnerability detection and remediation",
    category: "Security",
    content: `---
name: security-reviewer
description: Security analysis specialist
model: sonnet
---

# Security Reviewer

Analyze code for OWASP Top 10 vulnerabilities:
1. Injection (SQL, NoSQL, OS command)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

Flag all findings with severity and remediation steps.
`,
  },
  {
    name: "doc-writer",
    description: "Technical documentation and API docs generator",
    category: "Documentation",
    content: `---
name: doc-writer
description: Documentation generator
model: haiku
---

# Documentation Writer

Generate clear, concise documentation:
- README files with setup instructions
- API endpoint documentation
- Architecture decision records (ADRs)
- Code comments for complex logic only
- Changelog entries

Style: direct, technical, no fluff. Use examples over explanations.
`,
  },
];

export const RULE_TEMPLATES: ToolTemplate[] = [
  {
    name: "coding-standards",
    description: "Universal coding standards for TypeScript and JavaScript",
    category: "common",
    content: `# Coding Standards

## Immutability
Always create new objects, never mutate. Use spread operator, map, filter.

## File Organization
- 200-400 lines typical, 800 max
- One component per file
- Organize by feature, not by type

## Functions
- Max 50 lines per function
- Max 4 levels of nesting
- Descriptive names (verbs for functions, nouns for variables)

## Error Handling
- Handle errors explicitly at every level
- User-friendly messages in UI
- Detailed logging on server side
`,
  },
  {
    name: "git-workflow",
    description: "Git commit messages and PR conventions",
    category: "common",
    content: `# Git Workflow

## Commit Messages
Format: <type>: <description>
Types: feat, fix, refactor, docs, test, chore, perf, ci

## Pull Requests
- Keep PRs small and focused
- Include test plan
- Use descriptive title (under 70 chars)
- Reference related issues

## Branching
- feature/* for new features
- fix/* for bug fixes
- One feature = one branch
`,
  },
  {
    name: "security-guidelines",
    description: "Security best practices for web applications",
    category: "common",
    content: `# Security Guidelines

## Mandatory Checks Before Commit
- No hardcoded secrets
- All inputs validated
- Parameterized queries (no string concat SQL)
- Output sanitized (XSS prevention)
- Authentication verified
- Rate limiting enabled

## Secret Management
- Use environment variables
- Never commit .env files
- Rotate exposed secrets immediately
`,
  },
  {
    name: "testing-requirements",
    description: "Test coverage and TDD requirements",
    category: "common",
    content: `# Testing Requirements

## Coverage: 80% minimum

## Test Types (all required)
1. Unit tests - individual functions
2. Integration tests - API endpoints
3. E2E tests - critical user flows

## TDD Workflow
1. Write test (RED)
2. Implement (GREEN)
3. Refactor (IMPROVE)
`,
  },
  {
    name: "typescript-strict",
    description: "Strict TypeScript patterns and type safety",
    category: "typescript",
    content: `# TypeScript Strict Mode

## Rules
- Enable strict mode in tsconfig
- No \`any\` type (use \`unknown\` instead)
- No type assertions unless necessary
- Use discriminated unions over type guards
- Prefer interfaces for objects, types for unions
- Use \`as const\` for literal types
- Enable \`noUncheckedIndexedAccess\`
`,
  },
];

export const TOOL_CATEGORIES = {
  skills: ["All", "Development", "Quality", "Security", "DevOps"],
  agents: ["All", "Planning", "Quality", "Testing", "Security", "Documentation"],
  rules: ["All", "common", "typescript", "python"],
} as const;
