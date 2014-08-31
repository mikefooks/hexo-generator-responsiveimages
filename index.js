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

        imageProperties = assets.map(function (asset) {
            var source = path.join(baseDir, asset._id),
                fileName = path.basename(source),
                destDir = path.dirname(asset.path),
                isImg = imageTest.test(fileName);

            return {
                source: source,
                fileName: fileName,
                destDir: destDir,
                isImg: isImg,
                getResizedName: function (size) {
                    return generateFileName(fileName, size);
                }
            };
        }).filter(function (properties) {
            return properties.isImg;
        });

    // Create a temporary folder for our newly created images.
    fs.stat(tmpFolder, function (err) {
        if (err) {
            fs.mkdir(tmpFolder, function (err) {
                if (err) { return callback(err); }
            }); 
        }
    });

    async.eachSeries(imageProperties, function (image, callback) {
        async.series([
            function (callback) {
                async.each(sizeKeys, function (size, callback) {
                    var imageName = image.getResizedName(size);

                    gm(image.source)
                        .thumb(
                            imageSizes[size],
                            imageSizes[size],
                            path.join(tmpFolder, imageName),
                            60,
                            callback
                        );
                }, callback);
            }
        ], function (err) {
            if (err) { return callback(err); }
        });
    });

    callback();
});