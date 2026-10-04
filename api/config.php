<?php
/**
 * Database connection settings.
 *
 * ============================ READ BEFORE DEPLOYING ============================
 * These are the stock XAMPP localhost credentials: user "root" with an EMPTY
 * password. That is fine for a local learning project where MySQL only listens on
 * 127.0.0.1, and nothing else.
 *
 * Before putting this anywhere that is not your own machine you MUST:
 *   1. create a dedicated MySQL user with a real password and only the rights it
 *      needs on the `typing_game` database (SELECT, INSERT),
 *   2. change the values below to that user,
 *   3. move this file OUT of the web root (htdocs) and require it by an absolute
 *      path, or load the values from environment variables instead.
 * ===============================================================================
 */

const DB_HOST    = '127.0.0.1';
const DB_PORT    = 3306;
const DB_NAME    = 'typing_game';
const DB_USER    = 'root';
const DB_PASS    = '';
const DB_CHARSET = 'utf8mb4';
