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
    var assets = hexo.model("Asset").toArray().filter(function (asset) {
        return imageTest.test(asset._id);
    });

    fs.mkdirSync(tmpFolder);

    async.eachSeries(assets, function (asset, callback) {
        var image = (function () {
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
        })();

        async.each(sizeKeys, function (size, callback) {
            gm(image.source)
                .thumb(
                    imageSizes[size],
                    imageSizes[size],
                    image.tmp[size],
                    60,
                    function (err) {
                        if (err) { return callback(err); }

                        var rs = fs.createReadStream(image.tmp[size]);
                        hexo.route.set(image.dest[size], function (fn) {
                            fn(null, rs);
                        });

                        callback(); 
                    }
                );
        }, callback);

    }, function (err) {
        if (err) { return next(err); }
        next();
    });
});