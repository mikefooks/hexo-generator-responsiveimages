var fs = require("fs"),
    path = require("path"),
    async = require("async"),
    gm = require("gm"),
    rimraf = require("rimraf");

var imageSizes = hexo.config["responsive_image_sizes"],
    sizeKeys = Object.keys(imageSizes),
    imageTest = new RegExp(/(\.jpg|\.png|\.gif)$/);

var baseDir = hexo.base_dir,
    tmpFolder = path.join(baseDir, "imgTmp");

// Takes the original image filename and turns it into originalFileName_size.jpg.
function generateFileName(fileName, size) {
    return fileName.replace(imageTest, "_" + size + "$1");
}

// Delete the temp folder once generating is done.
hexo.on("generateAfter", function () {
    rimraf.sync(tmpFolder);
});

hexo.extend.generator.register("images", function (locals, render, next) {
    var assets = hexo.model("Asset");

    // Filter out any asset that isn't an image...
    var imagePaths = assets.filter(function (asset) {
        return imageTest.test(asset._id);
    // ... and build a collection of all the new filenames for
    // both the temporary and final destinations of the resized
    // images.
    }).map(function (asset) {
        var tmpPaths = {},
            destPaths = {},
            source = path.join(baseDir, asset._id),
            fileName = path.basename(source),
            destDir = path.dirname(asset.path);

        sizeKeys.forEach(function (size) {
            var resizedName = generateFileName(fileName, size);

            tmpPaths[size] = path.join(tmpFolder, resizedName);
            destPaths[size] = path.join(destDir, resizedName);
        });

        return {
            source: source,
            dest: destPaths,
            tmp: tmpPaths
        };
    });

    async.series([

        // Create a temporary folder for our new images.
        function (callback) {
            fs.mkdir(tmpFolder, callback);
        },

        // Generate the new resized images and put them in the
        // temporary directory.
        function (callback) {
            async.eachSeries(imagePaths, function (image, callback) {
                async.each(sizeKeys, function (size, callback) {
                    gm(image.source)
                        .thumb(
                            imageSizes[size],
                            imageSizes[size],
                            image.tmp[size],
                            60,
                            callback
                        );
                }, callback);
            }, callback);
        },

        // Set the appropriate Hexo route for each image and size.
        function (callback) {
            async.eachSeries(imagePaths, function (image, callback) {
                async.each(sizeKeys, function (size, callback) {
                    var rs = fs.createReadStream(image.tmp[size]);
                    hexo.route.set(image.dest[size], function (fn) {
                        fn(null, rs);
                    });
                    callback();
                }, callback);
            }, callback);
        }
    ], function (err) {
        next();
    });
});