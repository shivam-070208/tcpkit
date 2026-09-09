#!/usr/bin/env node
import { CliApplication } from './cli-application.js';

const rawArguments = process.argv.slice(2);
const cliApplication = new CliApplication();
void cliApplication.run(rawArguments);
