var fs = require("fs"),
    path = require("path"),
    async = require("async"),
    gm = require("gm"),
    rimraf = require("rimraf");

var htmlTag = hexo.util.html_tag,
    imageSizes = hexo.config['responsive_images'].sizes,
    sizeKeys = Object.keys(imageSizes),
    imageTest = new RegExp(/(\.jpg|\.png|\.gif)$/);

var baseDir = hexo.base_dir,
    tmpFolder = path.join("/tmp", "hexo-images");


/**
 * Takes the original image filename and turns it into 
 * originalFileName_size.jpg.
 */
function createPath(fileName, size) {
    return fileName.replace(imageTest, "_" + size + "$1");
}

// Delete the temp folder once generating is done.
hexo.on("generateAfter", function () {
    rimraf.sync(tmpFolder);
});


/**
 * A tag for conveniently generating the picture, source and image
 * elements in markdown.
 */
hexo.extend.tag.register("resp_img", function (args, content) {

    var config = hexo.config["responsive_images"];
        defaultImg = htmlTag("img", { srcset: createPath(args[0], config.default) }),
        sources = "";

    Object.keys(config.breakpoints).forEach(function (size) {
        sources += htmlTag("source", {
            srcset: createPath(args[0], size),
            media: "(min-width: " + config.breakpoints[size] + "px)"
        });
    });

    return htmlTag("picture", {}, sources + defaultImg);
});


/**
 * the generator which creates the resized images from 
 * the source file.
 */
hexo.extend.generator.register("images", function (locals, render, next) {
    var assets = hexo.model("Asset").toArray().filter(function (asset) {

        return imageTest.test(asset._id) && 
            asset.hasOwnProperty("post_id") &&
            asset.modified;
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
                var resizedName = createPath(fileName, size);

                tmpPaths[size] = path.join(tmpFolder, resizedName);
                destPaths[size] = path.join(destDir, resizedName);
            });

            return {
                source: source,
                dest: destPaths,
                tmp: tmpPaths
            };  
        })();

        async.waterfall([
            function (callback) {
                gm(image.source).size(function (err, dimensions) {
                    if (err) { return callback(err); }
                    var aspectRatio = dimensions.width / dimensions.height;

                    callback(null, aspectRatio);
                });
            },
            function (aspectRatio, callback) {
                async.each(sizeKeys, function (size, callback) {
                    gm(image.source).thumb(
                        imageSizes[size],
                        Math.floor(imageSizes[size] / aspectRatio),
                        image.tmp[size],
                        60,
                        callback
                    );
                }, callback);
            },
            function (callback) {
                sizeKeys.forEach(function (size) {
                    var rs = fs.createReadStream(image.tmp[size]);
                    hexo.route.set(image.dest[size], function (fn) {
                        fn(null, rs);
                    });         
                });

                callback();
            }
        ], callback);

    }, next);
});