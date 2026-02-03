# Tradyx

Investment platform built with .NET 9 and Clean Architecture.

## Project Structure

```
Tradyx/
├── src/
│   ├── Tradyx.Core/           # Domain layer (entities, interfaces)
│   ├── Tradyx.Infrastructure/ # Data access, security implementations
│   └── Tradyx.Api/            # Web API entry point
├── database/
│   └── schema.sql             # PostgreSQL database schema
└── docker-compose.yml         # Development database
```

## Prerequisites

- .NET 9 SDK
- Docker (for PostgreSQL)

## Getting Started

### 1. Start the database

```bash
docker-compose up -d
```

### 2. Restore packages and build

```bash
dotnet restore
dotnet build
```

### 3. Run the API

```bash
cd src/Tradyx.Api
dotnet run
```

The API will be available at:
- HTTP: http://localhost:5001
- HTTPS: https://localhost:7001
- Swagger UI: https://localhost:7001/swagger

## Architecture

This project follows **Clean Architecture** principles:

- **Core**: Contains domain entities and interfaces. Has no dependencies on other layers.
- **Infrastructure**: Implements data access (Dapper + PostgreSQL) and security (BCrypt).
- **Api**: ASP.NET Core Web API. Entry point for the application.

## Technologies

- .NET 9
- ASP.NET Core Web API
- PostgreSQL 16
- Dapper (micro ORM)
- BCrypt.Net-Next (password hashing)
- Swagger/OpenAPI
