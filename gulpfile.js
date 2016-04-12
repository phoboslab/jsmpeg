var gulp = require('gulp');
var concat = require('gulp-concat');
var argv = require('yargs').argv;
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var wrap = require("gulp-wrap");
var rename = require("gulp-rename");
var jshint = require('gulp-jshint');

var destination = argv.dist || 'bin/';

gulp.task('scripts', function() {
    gulp.src([
            'copyright.js',
            'constants.js',
            'bitreader.js',
            'jsmpg.js',
            //'sockets/recording.js',
            //'sockets/streaming.js',
            'callback.js',
        ].map(function(i){
            return 'src/'+i;
        }))
        .pipe(jshint())
        .pipe(jshint.reporter('default', { verbose: true }))
        .pipe(concat('jsmpg.js'))
        .pipe(wrap('"use strict";\n(function(window){\n<%= contents %>})(window);'))
        .pipe(gulp.dest(destination))
        .pipe(uglify())
        .on('error', function(error) {
            gutil.log(gutil.colors.red('Error building application sources'));
            gutil.log(('file: ' + error.fileName + ':' + error.lineNumber));
        })
        .pipe(rename({ extname: ".min.js" }))
        .pipe(gulp.dest(destination))
    ;
});

gulp.task('watch', function () {
    gulp.watch(['src/**/*.js'], ['scripts']);
});

gulp.task('default', (function(){
    return ['scripts', 'watch'];
})());
