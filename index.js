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

hexo.extend.generator.register("images", function (locals, render, callback) {
    var assets = hexo.model("Asset").toArray(),
        baseDir = hexo.base_dir,
        tmpFolder = path.join(baseDir, "imgTmp"),

        imageProperties = assets.filter(function (asset) {
            return imageTest.test(asset._id);
        }).map(function (asset) {
            var source = path.join(baseDir, asset._id),
                fileName = path.basename(source),
                destDir = path.dirname(asset.path);

            return {
                source: source,
                modified: asset.modified,
                fileName: fileName,
                destDir: destDir,
                getResizedName: function (size) {
                    return generateFileName(fileName, size);
                }
            };
        });

    // Create a temporary folder for our newly created images.
    fs.stat(tmpFolder, function (err) {
        if (err) {
            fs.mkdir(tmpFolder, function (err) {
                if (err) { return callback(err); }
            }); 
        }
    });

    async.waterfall([
        function (callback) {
            var resizedPaths = imageProperties.map(function (image) {
                var tmpPaths = {},
                    destPaths = {};
                
                sizeKeys.forEach(function (size) {
                    var resizedName =  image.getResizedName(size),
                        tmpPath = path.join(tmpFolder, resizedName),
                        destPath = path.join(image.destDir, resizedName);

                    tmpPaths[size] = tmpPath;
                    destPaths[size] = destPath;
                });
                
                return {
                    source: image.source,
                    dest: destPaths,
                    tmp: tmpPaths
                };
            });

            callback(null, resizedPaths);
        }, function (paths, callback) {
            async.eachSeries(paths, function (image, callback) {
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
            }, function () {
                callback(null, paths);
            });
        }
    ], function (err, paths) {
        async.eachSeries(paths, function (image, callback) {
            async.each(sizeKeys, function (size, callback) {
                hexo.route.set(image.dest[size], function (callback) {
                    callback(null, fs.createReadStream(image.tmp[size]));
                });
                callback();
            }, callback);
        }, callback);
    });
});