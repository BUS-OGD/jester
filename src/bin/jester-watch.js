#!/usr/bin/env node
"use strict";

var loadConfig = require("../lib/loadConfig"),
    lintFile = require("../lib/lintFile"),
    clearDir = require("../lib/clearDir"),
    rebuildProject = require("../lib/rebuildProject"),
    KarmaServer = require("../lib/karmaServer"),
    createTestFile = require("../lib/createTestFile"),
    watchr = require('watchr');

var config = loadConfig("./jester.json");
var server = new KarmaServer(config.karmaPath, config.karmaOptions);

function getTestFileNameForPath(path) {
    var result = "";
    if (path.length > 8 && path.substr(-8) === ".test.js") {
        result = path;
    }
    else if (path.length > 3 && path.substr(-3) === ".js") {
        var testfile = path.substr(0, path.length - 3) + ".test.js";

        if (require("fs").existsSync(testfile)) {
            result = testfile;
        }
    }

    return result;
}

function runTests(path) {
    lintFile(path, config.eslintRules)
        .then(function() {
            return clearDir(config.karmaPath);
        })
        .then(function() {
            var testFile = getTestFileNameForPath(path);
            if (!testFile) {
                console.log("No tests found for '" + path + "'");
                return false;
            }
            return createTestFile(testFile, config.karmaPath)
                .then(function () {
                    return server.run();
                }
            );
        })
        .done(
            function() {
                console.log("karma test succeeded for " + path);
            },
            function() {
                console.error("karma test failed for " + path);
            }
        );
}

function startWatching() {
    watchr.watch({
        paths: [config.srcPath],
        listeners: {
            error: function (error) {
                console.error('An error happened in the file update watcher', error);
            },
            change: function (changeType, filePath, fileCurrentStat, filePreviousStat) {
                try {
                    if (filePath == "jester.json") {
                        config = loadConfig("./jester.json");
                    }

                    if (filePath.length > 3 && filePath.substr(-3) === ".js") {
                        console.log("change:", filePath);
                        rebuildProject(config.fullEntryGlob, config.artifactPath)
                            .done(function() {
                                if (changeType === 'create' || (changeType === 'update' && fileCurrentStat.mtime !== filePreviousStat.mtime)) {
                                    runTests(filePath);
                                }
                            });
                    }
                } catch (error) {
                    console.error('An error happened in the file update watcher', error, error.stack);
                }
            }
        },
        persistent: true
    });
}

server.start().done(function(exitCode) {
     process.exit();
});

startWatching();
