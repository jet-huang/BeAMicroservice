# Runtime environment
#FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
FROM mcr.microsoft.com/dotnet/runtime:6.0 AS base

# Build
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build-env
WORKDIR /src

## Build - shared library
COPY SharedLibrary/*.csproj ./SharedLibrary/
COPY Aggregator/*.csproj ./Aggregator/
WORKDIR /src/Aggregator
RUN dotnet restore
# Copy everything else and build
WORKDIR /src
COPY . .
WORKDIR /src/Aggregator
RUN dotnet build --configuration Release -o /out

# Publish
FROM build-env AS publish
RUN dotnet publish --configuration Release -o /dist

FROM base AS runtime
ENV NETCORE_ENVIRONMENT=Production
WORKDIR /app
COPY --from=publish /dist .
ENTRYPOINT ["dotnet", "Aggregator.dll"]
