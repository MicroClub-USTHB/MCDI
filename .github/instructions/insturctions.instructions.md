# GitHub Copilot Instructions

<!-- BEGIN DEVELOPER-KIT -->
## Developer Kit — Available Capabilities

This repository has the Developer Kit installed. The following agents, skills,
and workflow commands are available to assist with development tasks.

### Agents
Agents are specialized AI assistants — reference by role when describing your task:

- **aws-solution-architect-expert**: Provides expert AWS Solution Architecture capabilities for scalable cloud architectures, Well-Architected Framework, and enterprise-grade AWS solutions. Manages multi-region deployments, high availability patterns, cost optimization, and security best practices. Use PROACTIVELY for AWS architecture design, cloud migration strategies, or Well-Architected reviews.
- **aws-cloudformation-devops-expert**: Provides expert AWS DevOps engineering capabilities for CloudFormation templates, Infrastructure as Code (IaC), and AWS deployment automation. Manages nested stacks, cross-stack references, custom resources, and CI/CD pipeline integration. Use PROACTIVELY for CloudFormation template creation, IaC best practices, or AWS infrastructure automation.
- **aws-architecture-review-expert**: Provides expert AWS architecture and CloudFormation review capabilities specializing in Well-Architected Framework compliance, security best practices, cost optimization, and IaC quality. Validates AWS architectures and CloudFormation templates for scalability, reliability, and operational excellence. Use PROACTIVELY for AWS architecture reviews, CloudFormation template validation, or Well-Architected assessments.
- **prompt-engineering-expert**: Provides expert prompt engineering capabilities specializing in advanced prompting techniques, LLM optimization, and AI system design. Masters chain-of-thought, constitutional AI, and production prompt strategies. Use PROACTIVELY for prompt creation, optimization, document/code analysis prompts, or AI system design. MUST BE USED for any prompt engineering task.
- **spring-boot-backend-development-expert**: Provides expert Spring Boot backend development capability, specializing in feature implementation, architecture, and best practices. Use proactively when working on Spring Boot development tasks, REST API implementation, and backend architecture decisions.
- **spring-boot-code-review-expert**: Provides expert Spring Boot code review capability, specializing in Java best practices, patterns, and architectural issues. Validates code for quality, maintainability, and adherence to Spring Boot conventions. Use proactively after code changes or when implementing new features.
- **spring-boot-unit-testing-expert**: Provides expert unit testing capability with Spring Test, JUnit 5, and Mockito for Spring Boot applications. Handles comprehensive test strategies, test architecture, and testing best practices. Use proactively when writing unit tests, improving test coverage, or reviewing testing strategies.
- **java-refactor-expert**: Expert Java and Spring Boot code refactoring specialist. Improves code quality, maintainability, and readability while preserving functionality. Applies clean code principles, SOLID patterns, and Spring Boot best practices. Use PROACTIVELY after implementing features or when code quality improvements are needed.
- **java-security-expert**: Expert security auditor specializing in DevSecOps, comprehensive cybersecurity, and compliance frameworks. Masters vulnerability assessment, threat modeling, secure authentication (OAuth2/OIDC), OWASP standards, cloud security, and security automation. Handles DevSecOps integration, compliance (GDPR/HIPAA/SOC2), and incident response. Use PROACTIVELY for security audits, DevSecOps, or compliance implementation.
- **java-software-architect-review**: Provides expert Java software architecture review capability, specializing in Clean Architecture, Domain-Driven Design (DDD), and Spring Boot patterns. Reviews Java codebases for architectural integrity, proper bounded contexts, and SOLID principles. Use proactively when making Java architectural decisions, DDD modeling, and Clean Architecture reviews.
- **java-documentation-specialist**: Provides expert Java documentation capabilities, creating comprehensive technical documentation from Spring Boot codebases. Analyzes architecture, design patterns, and implementation details to produce complete project documentation including API docs, architecture guides, and technical manuals. Use proactively when generating system documentation, architecture guides, API documentation, or technical deep-dives.
- **java-tutorial-engineer**: Expert Java tutorial engineer specializing in Spring Boot and LangChain4j educational content. Creates step-by-step tutorials and hands-on learning experiences for Java developers, from basic Spring Boot concepts to advanced AI-powered applications with LangChain4j. Use PROACTIVELY for onboarding guides, feature tutorials, concept explanations, or learning paths.
- **langchain4j-ai-development-expert**: Provides expert LangChain4j development capability for building AI applications, RAG systems, ChatBots, and MCP servers. Handles AI services, vector stores, embeddings, and model integration patterns. Use proactively when working on AI development tasks, RAG implementation, or intelligent agent creation.
- **github-actions-pipeline-expert**: Provides expert GitHub Actions engineering capability for CI/CD pipeline creation covering build, test, and deployment workflows. Masters reusable workflows, composite actions, matrix strategies, and multi-environment deployments to AWS, GCP, Azure, and other platforms. Use proactively when creating GitHub Actions workflows, optimizing pipelines, or automating deployments.
- **general-docker-expert**: Provides expert Docker capability for creating optimized Dockerfiles, multi-stage builds, container images, and Docker Compose configurations. Use proactively when working on containerization tasks, image optimization, and container orchestration.
- **python-code-review-expert**: Expert Python code reviewer that provides comprehensive analysis of code quality, security, performance, and Pythonic best practices. Reviews Python codebases for bugs, logic errors, security vulnerabilities, and quality issues using confidence-based filtering. Use PROACTIVELY for Python code reviews and pull request assessments.
- **python-refactor-expert**: Expert Python code refactoring specialist. Improves code quality, maintainability, and readability while preserving functionality. Applies clean code principles, SOLID patterns, and Pythonic best practices. Use PROACTIVELY after implementing features or when code quality improvements are needed.
- **python-security-expert**: Expert security auditor that provides comprehensive Python application security analysis, DevSecOps, and compliance frameworks. Masters vulnerability assessment, threat modeling, secure authentication (OAuth2/JWT), OWASP standards, and security automation. Use PROACTIVELY for security audits, DevSecOps integration, or compliance implementation in Python applications.
- **python-software-architect-expert**: Expert Python software architect that provides guidance on Clean Architecture, Domain-Driven Design (DDD), and modern Python patterns. Reviews Python codebases for architectural integrity, proper module organization, and SOLID principles. Use PROACTIVELY for Python architectural decisions, DDD modeling, and Clean Architecture reviews.
- **general-code-explorer**: Provides deep analysis of existing codebase features by tracing execution paths, mapping architecture layers, understanding patterns and abstractions, and documenting dependencies. Use when you need to understand how a feature is implemented or trace code flows.
- **general-code-reviewer**: Provides code review capability for bugs, logic errors, security vulnerabilities, and quality issues using confidence-based filtering to report only high-priority issues. Use when reviewing code changes or before merging pull requests.
- **general-refactor-expert**: Expert code refactoring specialist. Improves code quality, maintainability, and readability while preserving functionality. Applies clean code principles, SOLID patterns, and language-specific best practices. Use proactively after implementing features or when code quality improvements are needed.
- **general-software-architect**: Provides comprehensive feature architecture design by analyzing existing codebase patterns and delivering detailed implementation blueprints with specific files, components, data flows, and build sequences. Use when planning new features or designing system architecture.
- **general-debugger**: Provides expert debugging capability for root cause analysis. Traces execution paths, analyzes stack traces, identifies failure points, and proposes targeted fixes with minimal changes. Use proactively when encountering errors, test failures, or unexpected behavior.
- **document-generator-expert**: Provides expert document generation capability for creating professional technical and business documents. Produces comprehensive assessments, feature specifications, analysis reports, process documentation, and custom documents. Use proactively when generating any type of structured documentation including assessments, feature specs, technical analysis, process docs, and custom reports.
- **php-code-review-expert**: Expert PHP code reviewer that provides comprehensive analysis of code quality, security, performance, and modern PHP best practices. Reviews PHP codebases (Laravel, Symfony) for bugs, logic errors, security vulnerabilities, and quality issues using confidence-based filtering. Use PROACTIVELY for PHP code reviews and pull request assessments.
- **php-refactor-expert**: Expert PHP code refactoring specialist. Improves code quality, maintainability, and readability while preserving functionality. Applies clean code principles, SOLID patterns, and modern PHP 8.3+ best practices for Laravel and Symfony. Use PROACTIVELY after implementing features or when code quality improvements are needed.
- **php-security-expert**: Expert security auditor that provides comprehensive PHP application security analysis, DevSecOps, and compliance frameworks. Masters vulnerability assessment, threat modeling, secure authentication (OAuth2/JWT), OWASP standards, and security automation for Laravel and Symfony. Use PROACTIVELY for security audits, DevSecOps integration, or compliance implementation in PHP applications.
- **php-software-architect-expert**: Expert PHP software architect that provides guidance on Clean Architecture, Domain-Driven Design (DDD), and modern PHP patterns. Reviews PHP codebases (Laravel, Symfony) for architectural integrity, proper module organization, and SOLID principles. Use PROACTIVELY for PHP architectural decisions, DDD modeling, and Clean Architecture reviews.
- **wordpress-development-expert**: Expert WordPress developer that provides custom plugin and theme development capabilities. Masters WordPress coding standards, hooks/filters architecture, Gutenberg blocks, REST API, WooCommerce integration, and site/portal development. Use PROACTIVELY for WordPress plugin development, theme customization, Gutenberg blocks, and site architecture decisions.
- **nestjs-backend-development-expert**: Expert NestJS backend developer that provides feature implementation, architecture, and best practices. Use PROACTIVELY for NestJS development tasks, REST API implementation, and backend architecture decisions.
- **nestjs-code-review-expert**: Expert NestJS code reviewer that provides analysis of TypeScript best practices, NestJS patterns, and architectural issues. Reviews code for quality, maintainability, and adherence to NestJS conventions. Use PROACTIVELY after code changes or when implementing new features.
- **nestjs-database-expert**: NestJS database specialist that provides expertise in Drizzle ORM setup, schema design, migrations, queries, transactions, and database operations. Use proactively when working with database-related code in NestJS applications, setting up Drizzle ORM, creating migrations, writing queries, or optimizing database performance.
- **nestjs-security-expert**: NestJS security specialist that provides authentication, authorization, JWT implementation, guards, security middleware, and security best practices. Use proactively when implementing authentication systems, securing endpoints, adding user roles and permissions, implementing OAuth/SSO, or addressing security vulnerabilities in NestJS applications.
- **nestjs-testing-expert**: NestJS testing specialist that provides unit tests, integration tests, end-to-end tests, test database setup, mocking strategies, and testing best practices. Use proactively when writing tests for NestJS applications, setting up testing infrastructure, creating test fixtures, mocking dependencies, or implementing testing strategies with Drizzle ORM.
- **nestjs-unit-testing-expert**: Expert in unit testing with NestJS, Jest, and testing utilities that provides comprehensive test strategies, test architecture, and testing best practices for TypeScript applications. Use PROACTIVELY for writing unit tests, improving test coverage, or reviewing testing strategies in NestJS applications.
- **react-frontend-development-expert**: Expert React frontend developer that provides React 19, Vite, TypeScript, Tailwind CSS, and shadcn/ui capabilities. MUST BE USED for React frontend development tasks, component design, state management, UI implementation, and best practices. Use PROACTIVELY for building modern, responsive, and accessible React applications with latest React 19 features.
- **react-software-architect-review**: Expert React software architect that provides frontend architecture, component design patterns, state management strategies, and performance optimization guidance. Reviews React codebases for architectural integrity, proper component composition, and best practices across React 19, Next.js, Remix, and modern frontend frameworks. Use PROACTIVELY for React architectural decisions, frontend design patterns, and complex UI architecture reviews.
- **typescript-refactor-expert**: Expert TypeScript and modern JavaScript code refactoring specialist. Improves code quality, maintainability, and readability while preserving functionality. Applies clean code principles, SOLID patterns, and TypeScript best practices. Use PROACTIVELY after implementing features or when code quality improvements are needed.
- **typescript-security-expert**: Expert security auditor specializing in TypeScript/Node.js application security, DevSecOps, and comprehensive cybersecurity. Masters vulnerability assessment, threat modeling, secure authentication (JWT/OAuth2), OWASP standards, and TypeScript-specific security patterns. Handles security for Express, NestJS, Next.js, and Node.js applications. Use PROACTIVELY for TypeScript security audits, DevSecOps, or compliance implementation.
- **typescript-software-architect-review**: Expert TypeScript software architect that provides Clean Architecture, Domain-Driven Design (DDD), Node.js patterns, and modern TypeScript frameworks guidance. Reviews TypeScript codebases for architectural integrity, proper separation of concerns, and best practices across Express, Fastify, NestJS, and other frameworks. Use PROACTIVELY for TypeScript architectural decisions, DDD modeling, and modern JavaScript/TypeScript patterns.
- **typescript-documentation-expert**: Expert TypeScript documentation specialist that generates comprehensive technical documentation for TypeScript projects. Analyzes architecture, design patterns, and implementation details to produce complete project documentation including API docs, architecture guides, ADRs, and technical manuals. Use PROACTIVELY for system documentation, architecture guides, API documentation, and technical deep-dives.
- **expo-react-native-development-expert**: Expert Expo and React Native mobile developer that provides cross-platform mobile app development capabilities with Expo SDK 54, React Native 0.81, React 19.1, TypeScript, and modern mobile UI patterns. MUST BE USED for Expo/React Native development tasks, mobile UI implementation, navigation, state management, and native module integration. Use PROACTIVELY for building production-ready iOS and Android applications.

### Workflow Commands (Claude Code)
These commands run in Claude Code via slash syntax. In GitHub Copilot, describe
the same intent in natural language — the installed agents will handle it:

- **/devkit.prompt-optimize**: Provides expert prompt optimization using advanced techniques (CoT, few-shot, constitutional AI) for LLM performance enhancement. Use when you need to improve prompt quality or optimize LLM interactions.
- **/devkit.java.code-review**: Validates Java code quality for enterprise Spring applications with security, performance, architecture and best practices analysis. Use when reviewing code changes or before merging pull requests.
- **/devkit.java.generate-crud**: Generates complete CRUD implementation for a Spring Boot domain class using spring-boot-crud-patterns skill. Use when creating new domain entities with REST endpoints.
- **/devkit.java.refactor-class**: Provides intelligent refactoring for complex Java classes with architectural analysis and Spring Boot patterns. Use when refactoring large or complex Java classes.
- **/devkit.java.architect-review**: Validates Java application architecture focusing on Clean Architecture, DDD, and Spring Boot patterns. Use when reviewing architectural decisions or before major refactoring.
- **/devkit.java.dependency-audit**: Validates Java project dependencies with vulnerability scanning, license compliance, and supply chain security analysis. Use when auditing project dependencies or before releases.
- **/devkit.java.generate-docs**: Generates comprehensive Java project documentation including API docs, architecture diagrams, and Javadoc. Use when creating or updating project documentation.
- **/devkit.java.security-review**: Validates security posture for Java enterprise applications (Spring, Jakarta EE, etc.). Use when auditing application security or before production deployments.
- **/devkit.java.upgrade-dependencies**: Manages safe and incremental dependency upgrades for Java/Maven/Gradle projects with breaking change detection and migration guides. Use when upgrading project dependencies or migrating to new library versions.
- **/devkit.java.write-unit-tests**: Generates comprehensive JUnit 5 unit tests for Java classes with Mockito mocking and AssertJ assertions. Use when writing unit tests for service, controller, or utility classes.
- **/devkit.java.write-integration-tests**: Generates comprehensive integration tests for Spring Boot classes using Testcontainers (PostgreSQL, Redis, MongoDB) with `@ServiceConnection` pattern. Use when writing integration tests for service or repository classes.
- **/devkit.java.generate-refactoring-tasks**: Generates a comprehensive refactoring task list for a specific Bounded Context in project and saves it to a file. Use when planning refactoring work for a bounded context.
- **/speckit.check-integration**: Validates that tasks.md considers existing codebase implementations and integration opportunities before execution. Use when you need to check task alignment with the current codebase.
- **/speckit.optimize**: Provides task workflow optimization by analyzing dependencies, parallelization opportunities, and subagent delegation strategy for tasks.md. Use when you need to improve task execution efficiency.
- **/speckit.verify**: Validates implementation completion by checking tasks, logic, tests, and code quality against specifications. Use when you need to verify that all tasks are properly completed.
- **/devkit.brainstorm**: Provides guided brainstorming capability to transform ideas into fully formed designs with documentation and next-step recommendations. Use when starting a new feature or exploring design alternatives.
- **/devkit.refactor**: Provides guided code refactoring capability with deep codebase understanding, compatibility options, and comprehensive verification. Use when restructuring or improving existing code.
- **/devkit.feature-development**: Provides guided feature development capability with codebase understanding and architecture focus. Use when implementing a new feature from scratch.
- **/devkit.fix-debugging**: Provides guided bug fixing and debugging capability with systematic root cause analysis. Use when encountering bugs, errors, or unexpected behavior.
- **/devkit.generate-document**: Generates professional documents (assessments, features, analysis, process, custom) with language support and specialized sub-agents. Use when you need to create structured technical or business documentation.
- **/devkit.generate-changelog**: Generates and manages project changelog following Keep a Changelog standard with Git integration and Conventional Commits support. Use when releasing a new version or updating the changelog after commits.
- **/devkit.github.create-pr**: Creates a GitHub pull request with branch creation, commits, and detailed description. Use when you need to submit changes for review.
- **/devkit.github.review-pr**: Provides comprehensive GitHub pull request review with code quality, security, and best practices analysis. Use when reviewing a PR before merging.
- **/devkit.lra.init**: Initialize environment for long-running agent workflow (creates feature list, progress file, init.sh)
- **/devkit.lra.add-feature**: Add a new feature to the feature list
- **/devkit.lra.checkpoint**: Create a checkpoint - commit changes, update progress log, leave clean state for next session
- **/devkit.lra.mark-feature**: Mark a feature as completed (passed) or failed
- **/devkit.lra.recover**: Recover from a broken state - diagnose issues, revert if needed, restore working state
- **/devkit.lra.start-session**: Start a new coding session - reads progress, chooses next feature, runs basic tests
- **/devkit.lra.status**: Show current project status - features progress, recent activity, next priorities
- **/devkit.verify-skill**: Validates a skill against DevKit standards (requirements, template, dependencies). Use when you need to verify a skill before publishing or after modifications.
- **/devkit.generate-security-assessment**: Generates comprehensive security assessment document after security audit completion. Use when you need to create a structured security report.
- **/devkit.write-a-minute-of-a-meeting**: Generates professional meeting minutes from transcripts or notes. Use when you need to create structured meeting documentation after a meeting.
- **/devkit.typescript.code-review**: Provides comprehensive TypeScript monorepo code review for Nx workspaces including NestJS backend, React web, and React Native mobile apps. Use when reviewing architecture, boundaries, security, performance, CI/CD and Nx-specific practices.
- **/devkit.react.code-review**: Provides comprehensive React 19 + Tailwind CSS code review focusing on modern patterns, hooks, Server Components, Actions, performance, accessibility, and Tailwind best practices. Use when reviewing React code changes or before merging pull requests.
- **/devkit.ts.security-review**: Provides comprehensive security review for TypeScript/Node.js applications (Next.js, NestJS, Express, etc.). Use when auditing security vulnerabilities or before deploying to production.

### Installed Skills
Skills provide domain-specific knowledge applied automatically when relevant:

- aws-cloudformation-vpc
- aws-cloudformation-ec2
- aws-cloudformation-lambda
- aws-cloudformation-iam
- aws-cloudformation-s3
- aws-cloudformation-rds
- aws-cloudformation-dynamodb
- aws-cloudformation-ecs
- aws-cloudformation-auto-scaling
- aws-cloudformation-cloudwatch
- aws-cloudformation-cloudfront
- aws-cloudformation-security
- aws-cloudformation-elasticache
- aws-cloudformation-bedrock
- aws-cloudformation-task-ecs-deploy-gh
- aws-drawio-architecture-diagrams
- aws-cli-beast
- aws-sam-bootstrap
- aws-cost-optimization
- prompt-engineering
- chunking-strategy
- rag
- spring-boot-actuator
- spring-boot-cache
- spring-boot-crud-patterns
- spring-boot-dependency-injection
- spring-boot-event-driven-patterns
- spring-boot-openapi-documentation
- spring-boot-rest-api-standards
- spring-boot-saga-pattern
- spring-boot-security-jwt
- spring-boot-test-patterns
- spring-boot-resilience4j
- spring-boot-project-creator
- spring-data-jpa
- spring-data-neo4j
- spring-ai-mcp-server-patterns
- unit-test-application-events
- unit-test-bean-validation
- unit-test-boundary-conditions
- unit-test-caching
- unit-test-config-properties
- unit-test-controller-layer
- unit-test-exception-handler
- unit-test-json-serialization
- unit-test-mapper-converter
- unit-test-parameterized
- unit-test-scheduled-async
- unit-test-security-authorization
- unit-test-service-layer
- unit-test-utility-methods
- unit-test-wiremock-rest-api
- langchain4j-ai-services-patterns
- langchain4j-mcp-server-patterns
- langchain4j-rag-implementation-patterns
- langchain4j-spring-boot-integration
- langchain4j-testing-strategies
- langchain4j-tool-function-calling-patterns
- langchain4j-vector-stores-configuration
- qdrant
- aws-rds-spring-boot-integration
- aws-sdk-java-v2-bedrock
- aws-sdk-java-v2-core
- aws-sdk-java-v2-dynamodb
- aws-sdk-java-v2-kms
- aws-sdk-java-v2-lambda
- aws-sdk-java-v2-messaging
- aws-sdk-java-v2-rds
- aws-sdk-java-v2-s3
- aws-sdk-java-v2-secrets-manager
- aws-lambda-java-integration
- clean-architecture
- graalvm-native-image
- clean-architecture
- aws-lambda-python-integration
- claude-md-management
- drawio-logical-diagrams
- github-issue-workflow
- docs-updater
- gemini
- notebooklm
- copilot-cli
- aws-lambda-php-integration
- wordpress-sage-theme
- clean-architecture
- nestjs
- nestjs-drizzle-crud-generator
- react-patterns
- shadcn-ui
- tailwind-css-patterns
- tailwind-design-system
- typescript-docs
- clean-architecture
- better-auth
- nextjs-app-router
- nextjs-authentication
- nextjs-data-fetching
- nextjs-performance
- nextjs-deployment
- drizzle-orm-patterns
- dynamodb-toolbox-patterns
- nx-monorepo
- turborepo-monorepo
- aws-lambda-typescript-integration
- nestjs-code-review
- nextjs-code-review
- react-code-review
- typescript-security-review
- nestjs-best-practices
- zod-validation-utilities

<!-- END DEVELOPER-KIT -->
