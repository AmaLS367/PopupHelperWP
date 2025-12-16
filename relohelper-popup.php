<?php
declare(strict_types=1);

namespace ReloHelper;

/**
 * Plugin Name: ReloHelper Popup
 * Description: Lightweight popup for WordPress. Injects a single #popup-root mount and enqueues JS/CSS. Text and visual content live in /assets/content and are selected via JS config.
 * Version: 1.0.0
 * Author: Ama
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: MIT
 * Text Domain: relohelper-popup
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Plugin
{
    private const VERSION = '1.0.0';

    public static function run(): void
    {
        add_action('wp_footer', [self::class, 'renderRoot']);
        add_action('wp_enqueue_scripts', [self::class, 'enqueueAssets'], 20);
        add_action('init', [self::class, 'loadTextdomain']);
    }

    public static function renderRoot(): void
    {
        echo '<div id="popup-root" style="display:block"></div>';
    }

    public static function enqueueAssets(): void
    {
        if (is_admin()) {
            return;
        }

        $dir = plugin_dir_path(__FILE__);
        $url = plugin_dir_url(__FILE__);

        $cssPath = $dir . 'assets/css/popup.css';
        $cssUrl = $url . 'assets/css/popup.css';
        $cssVer = self::getFileVersion($cssPath);

        $helpersPath = $dir . 'utils/helpers.js';
        $helpersUrl = $url . 'utils/helpers.js';
        $helpersVer = self::getFileVersion($helpersPath);

        $configPath = $dir . 'assets/js/config.js';
        $configUrl = $url . 'assets/js/config.js';
        $configVer = self::getFileVersion($configPath);

        $statePath = $dir . 'assets/js/state.js';
        $stateUrl = $url . 'assets/js/state.js';
        $stateVer = self::getFileVersion($statePath);

        $triggersPath = $dir . 'assets/js/triggers.js';
        $triggersUrl = $url . 'assets/js/triggers.js';
        $triggersVer = self::getFileVersion($triggersPath);

        $popupPath = $dir . 'assets/js/popup.js';
        $popupUrl = $url . 'assets/js/popup.js';
        $popupVer = self::getFileVersion($popupPath);

        wp_enqueue_style('rhp-popup-css', $cssUrl, [], $cssVer);

        wp_enqueue_script('rhp-helpers', $helpersUrl, [], $helpersVer, true);
        wp_enqueue_script('rhp-config', $configUrl, [], $configVer, true);
        wp_enqueue_script('rhp-state', $stateUrl, [], $stateVer, true);
        wp_enqueue_script('rhp-triggers', $triggersUrl, [], $triggersVer, true);
        wp_enqueue_script('rhp-popup', $popupUrl, ['rhp-helpers', 'rhp-config', 'rhp-state', 'rhp-triggers'], $popupVer, true);

        $currentContent = self::resolveContentForCurrentPage();

        wp_localize_script(
            'rhp-popup',
            'RHP_DATA',
            [
                'baseUrl' => untrailingslashit($url),
                'assetsUrl' => untrailingslashit($url) . '/assets',
                'content' => $currentContent,
            ]
        );
    }

    private static function getFileVersion(string $filePath): string
    {
        return file_exists($filePath) ? (string) filemtime($filePath) : self::VERSION;
    }

    private static function resolveContentForCurrentPage(): ?array
    {
        $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($requestUri, PHP_URL_PATH);
        
        if ($path === false || $path === null) {
            $path = '/';
        }

        if ($path !== '/' && substr($path, -1) !== '/') {
            $path .= '/';
        }

        $configPath = plugin_dir_path(__FILE__) . 'assets/js/config.js';
        if (!file_exists($configPath)) {
            return null;
        }

        $configContent = file_get_contents($configPath);
        if ($configContent === false) {
            return null;
        }

        if (!preg_match('/pages:\s*\[([\s\S]*?)\]\s*,?\s*fallback:/', $configContent, $pagesMatch)) {
            return null;
        }

        $pagesStr = $pagesMatch[1];
        $pages = [];
        
        $depth = 0;
        $currentPage = '';
        $inString = false;
        $stringChar = '';
        
        for ($i = 0; $i < strlen($pagesStr); $i++) {
            $char = $pagesStr[$i];
            
            if (!$inString && ($char === '"' || $char === "'")) {
                $inString = true;
                $stringChar = $char;
            } elseif ($inString && $char === $stringChar && ($i === 0 || $pagesStr[$i - 1] !== '\\')) {
                $inString = false;
            }
            
            if (!$inString) {
                if ($char === '{') {
                    $depth++;
                    if ($depth === 1) {
                        $currentPage = '';
                    }
                } elseif ($char === '}') {
                    $depth--;
                    if ($depth === 0 && $currentPage !== '') {
                        $page = [];
                        if (preg_match('/match:\s*["\']([^"\']+)["\']/', $currentPage, $match)) {
                            $page['match'] = $match[1];
                        }
                        if (preg_match('/contentFile:\s*["\']([^"\']+)["\']/', $currentPage, $file)) {
                            $page['contentFile'] = $file[1];
                        }
                        if (!empty($page)) {
                            $pages[] = $page;
                        }
                        $currentPage = '';
                    }
                }
            }
            
            if ($depth > 0) {
                $currentPage .= $char;
            }
        }
        $bestMatch = null;
        $bestLen = -1;

        foreach ($pages as $page) {
            $match = $page['match'] ?? null;
            if (!is_string($match)) {
                continue;
            }

            if ($match !== '/' && substr($match, -1) !== '/') {
                $match .= '/';
            }

            if (strpos($path, $match) === 0 && strlen($match) > $bestLen) {
                $bestLen = strlen($match);
                $bestMatch = $page;
            }
        }

        if ($bestMatch === null) {
            $bestMatch = array_values(array_filter($pages, function ($p) {
                return ($p['match'] ?? null) === '/';
            }))[0] ?? null;
        }

        if ($bestMatch === null) {
            return null;
        }

        $contentFile = $bestMatch['contentFile'] ?? null;
        if (!is_string($contentFile) || $contentFile === '') {
            return null;
        }

        $contentFileName = basename($contentFile);
        if (preg_match('/\.txt$/i', $contentFileName)) {
            $contentFileName = preg_replace('/\.txt$/i', '', $contentFileName);
        }

        $contentDir = plugin_dir_path(__FILE__) . 'assets/content/';
        $jsonFile = $contentDir . $contentFileName . '.json';
        $txtFile = $contentDir . $contentFileName . '.txt';

        if (file_exists($jsonFile) && is_file($jsonFile)) {
            $jsonContent = file_get_contents($jsonFile);
            if ($jsonContent !== false) {
                $decoded = json_decode($jsonContent, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        if (file_exists($txtFile) && is_file($txtFile)) {
            $txtContent = file_get_contents($txtFile);
            if ($txtContent !== false) {
                return self::parseKvText($txtContent);
            }
        }

        return null;
    }


    private static function parseKvText(string $text): array
    {
        $result = [];
        $lines = explode("\n", str_replace("\r\n", "\n", $text));

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            if ($key !== '') {
                if ($key === 'subtitle1') {
                    $result['subtitleLine1'] = $value;
                } elseif ($key === 'subtitle2') {
                    $result['subtitleLine2'] = $value;
                } else {
                    $result[$key] = $value;
                }
            }
        }

        return $result;
    }


    public static function loadTextdomain(): void
    {
        $languagesDir = dirname(plugin_basename(__FILE__)) . '/languages';

        if (is_dir(plugin_dir_path(__FILE__) . 'languages')) {
            load_plugin_textdomain(
                'relohelper-popup',
                false,
                $languagesDir
            );
        }
    }
}

Plugin::run();