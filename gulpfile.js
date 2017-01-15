var fs = require('fs');
var path = require('path');
var gulp = require('gulp');

var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var sourcemaps = require('gulp-sourcemaps');
var cleanCSS = require('gulp-clean-css');
var imagemin = require('gulp-imagemin');
var deploy = require('gulp-gh-pages');
var gutil = require('gulp-util');

var plugins = require('gulp-load-plugins')();

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
var runSequence = require('run-sequence');

var pkg = require('./package.json');
var dirs = pkg['h5bp-configs'].directories;

gulp.task('archive:create_archive_dir', function() {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function(done) {
    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function(error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function(file) {
        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath).mode
        });
    });

    archiver.pipe(output);
    archiver.finalize();
});

gulp.task('clean', function(done) {
    require('del')([
        dirs.archive,
        dirs.dist
    ]).then(function() {
        done();
    });
});

gulp.task('copy', [
    'copy:license',
    'copy:.htaccess',
    'copy:index.html',
    'copy:jquery',
    'copy:easing',
    'copy:vide',
    'copy:misc',
    'copy:normalize'
]);

gulp.task('copy:license', function() {
    return gulp.src('LICENSE.txt')
        .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:.htaccess', function() {
    return gulp.src('node_modules/apache-server-configs/dist/.htaccess')
       .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
       .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:index.html', function() {
    return gulp.src(dirs.src + '/index.html')
        .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, pkg.devDependencies.jquery))
        .pipe(plugins.replace(/{{JQUERY_VIDE_VERSION}}/g, pkg.devDependencies.vide))
        .pipe(plugins.replace(/{{JQUERY_EASE_VERSION}}/g, pkg.devDependencies['jquery.easing']))
        .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:jquery', function() {
    return gulp.src(['node_modules/jquery/dist/jquery.min.js'])
       .pipe(plugins.rename('jquery-' + pkg.devDependencies.jquery + '.min.js'))
       .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:easing', function() {
    return gulp.src(['node_modules/jquery.easing/jquery.easing.min.js'])
       .pipe(plugins.rename('jquery.easing-' + pkg.devDependencies['jquery.easing'] + '.min.js'))
       .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:vide', function() {
    return gulp.src(['node_modules/vide/dist/jquery.vide.min.js'])
        .pipe(plugins.rename('jquery.vide-' + pkg.devDependencies.vide + '.min.js'))
        .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:misc', function() {
    var src = dirs.src;

    return gulp.src([
        src + '/**/*',
        '!' + src + '/index.html',
        '!' + src + '/assets',
        '!' + src + '/css',
        '!' + src + '/js'
    ], { dot: true })
        .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:normalize', function() {
    return gulp.src('node_modules/normalize.css/normalize.css')
       .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('lint:js', function() {
    return gulp.src([
        'gulpfile.js',
        dirs.src + '/js/*.js'
    ]).pipe(plugins.jscs())
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('jshint-stylish'))
      .pipe(plugins.jshint.reporter('fail'));
});

gulp.task('assets', function() {
    gulp.src(dirs.src + '/assets/**/*')
        .pipe(imagemin())
        .pipe(gulp.dest(dirs.dist + '/assets'));
});

gulp.task('css', function() {
    return gulp.src(dirs.src + '/css/main.css')
        .pipe(cleanCSS())
        .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('js', function bundle() {
    return browserify({
        entries: [ './src/js/entry.js' ],
        debug: true
    }).bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('js/bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(dirs.dist));
});


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('build', function(done) {
    runSequence(
        [ 'clean', 'lint:js' ],
        [ 'copy', 'js', 'css', 'assets' ],
    done);
});

gulp.task('dev-build', function(done) {
    runSequence(
        [ 'clean' ],
        [ 'copy', 'js', 'css', 'assets' ],
        done);
});

gulp.task('watch', function() {
    gulp.watch('src/**/*', [ 'dev-build' ]);
});

gulp.task('deploy', [ 'build' ], function () {
    return gulp.src("./dist/**/*")
        .pipe(deploy());
});

gulp.task('archive', function(done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
        done);
});

gulp.task('default', [ 'build' ]);
