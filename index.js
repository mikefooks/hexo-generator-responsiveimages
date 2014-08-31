var fs = require("fs"),
    path = require("path"),
    async = require("async"),
    gm = require("gm");

var imageSizes = hexo.config["responsive_image_sizes"],
    sizeKeys = Object.keys(imageSizes),
    imageTest = new RegExp(/(\.jpg|\.png|\.gif)$/);


// Takes the original image filename and turns it into originalFileName_size.jpg.
function generateFileName(fileName, size) {
    return fileName.replace(imageTest, "_" + size + "$1");
}

hexo.extend.generator.register("images", function (locals, render, next) {
    var assets = hexo.model("Asset").toArray(),
        baseDir = hexo.base_dir,
        tmpFolder = path.join(baseDir, "imgTmp"),

        // Filter out any asset that isn't an image.
        imagePaths = assets.filter(function (asset) {
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
                var resizedName = generateFileName(fileName, size),
                    tmpPath = path.join(tmpFolder, resizedName),
                    destPath = path.join(destDir, resizedName);

                tmpPaths[size] = tmpPath;
                destPaths[size] = destPath;
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
                    hexo.route.set(image.dest[size], function (fn) {
                        fn(null, fs.createReadStream(image.tmp[size]));
                    });
                    callback();
                }, callback);
            }, callback);
        }
    ], function (err) {
        next();
    });
});