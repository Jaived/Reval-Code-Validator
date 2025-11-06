# Contributing to Reval Code Validator

## Code Style

- Use TypeScript strict mode
- Follow Angular style guide (https://angular.io/guide/styleguide)
- Use meaningful variable and function names
- Document public functions and complex logic
- Write unit tests for services and components

## Commit Guidelines

Format: `<type>(<scope>): <subject>`

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes (formatting, missing semi colons, etc)
- refactor: Code changes that neither fixes a bug or adds a feature
- test: Adding missing tests
- chore: Changes to build process or auxiliary tools

Example:
```
feat(validate): add TypeScript validation
fix(css-diff): handle empty rules correctly
docs(readme): update installation steps
```

## Pull Request Process

1. Create a feature branch from `main`
2. Update documentation if needed
3. Add/update tests
4. Ensure all tests pass
5. Request review from maintainers

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm start`
4. Make your changes
5. Run tests: `npm test`
6. Run linting: `npm run lint`
7. Commit your changes using the commit guidelines
8. Push to your fork and submit a pull request

## Adding New Features

1. Discuss major changes in issues first
2. Keep changes focused and atomic
3. Consider browser performance
4. Maintain offline-first approach
5. Follow existing patterns and conventions

## Report Issues

1. Check existing issues first
2. Include steps to reproduce
3. Include expected vs actual behavior
4. Include browser and OS version
5. Include error messages and stack traces if any

## Questions?

Feel free to open an issue for clarification or reach out to maintainers.

Thank you for contributing!