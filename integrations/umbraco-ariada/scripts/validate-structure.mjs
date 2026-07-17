#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const project = readFileSync(resolve(root, 'Ariada.Umbraco.csproj'), 'utf8');
const service = readFileSync(resolve(root, 'src/AriadaScanService.cs'), 'utf8');

if (!project.includes('<TargetFramework>net8.0</TargetFramework>')) throw new Error('Umbraco package must target net8.0');
if (!project.includes('Umbraco.Cms.Core')) throw new Error('Umbraco package must reference Umbraco.Cms.Core');
if (!service.includes('AriadaScanRequest') || !service.includes('umbraco.content-app')) {
  throw new Error('Umbraco scan service must expose Ariada request mapping');
}

console.log('PASS umbraco-ariada structure');
