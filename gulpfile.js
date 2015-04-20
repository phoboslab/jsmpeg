var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
// var concat = require('gulp-concat');

gulp.task('scripts', function() {
  browserify({
    entries: ['./src/jsmpg.js'],
    standalone: 'jsmpeg'
  })
    .bundle()
    .pipe(source('jsmpg.js'))
    .pipe(gulp.dest('./'))
  ;
});


gulp.task('watch', function () {
  gulp.watch(['./src/*.js'], ['scripts']);
});
