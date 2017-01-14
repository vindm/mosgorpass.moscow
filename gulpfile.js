var fs = require('fs');
var path = require('path');

var gulp = require('gulp');

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var cleanCSS = require('gulp-clean-css');

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
    'copy:.htaccess',
    'copy:index.html',
    'copy:jquery',
    'copy:easing',
    'copy:vide',
    'copy:license',
    'copy:main.css',
    'copy:assets',
    'copy:misc',
    'copy:normalize'
]);

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


gulp.task('copy:license', function() {
    return gulp.src('LICENSE.txt')
       .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:main.css', function() {
    return gulp.src(dirs.src + '/css/main.css')
        .pipe(cleanCSS())
       .pipe(gulp.dest(dirs.dist + '/css'));
});

var imagemin = require('gulp-imagemin');

gulp.task('copy:assets', function() {
    gulp.src('src/assets/**/*')
        .pipe(imagemin())
        .pipe(gulp.dest('dist/assets'));
});

gulp.task('copy:misc', function() {
    return gulp.src([
        dirs.src + '/**/*',
        '!' + dirs.src + '/css/**/',
        '!' + dirs.src + '/js/**/',
        '!' + dirs.src + '/index.html',
        '!' + dirs.src + '/assets/'
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
        dirs.src + '/js/*.js',
        dirs.test + '/*.js'
    ]).pipe(plugins.jscs())
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('jshint-stylish'))
      .pipe(plugins.jshint.reporter('fail'));
});

var b = browserify({
    entries: ['./src/js/entry.js'],
    debug: true
});

gulp.task('js', function bundle() {
    return b.bundle()
    // log errors if they happen
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('js/bundle.js'))
        // optional, remove if you don't need to buffer file contents
        .pipe(buffer())
        // optional, remove if you dont want sourcemaps
        .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
        // Add transformation tasks to the pipeline here.
        .pipe(sourcemaps.write('./')) // writes .map file
        .pipe(gulp.dest('./dist'));
});


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', function(done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done);
});

gulp.task('build', function(done) {
    runSequence(
        [ 'clean', 'lint:js' ],
        'copy',
    done);
});

gulp.task('dev-build', function(done) {
    runSequence('clean', 'js', 'copy', done);
});

gulp.task('watch', function() {
    gulp.watch('src/**/*', [ 'dev-build' ]);
});

gulp.task('default', [ 'build' ]);
