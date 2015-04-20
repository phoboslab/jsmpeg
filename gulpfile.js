var gulp = require('gulp');
var concat = require('gulp-concat');

gulp.task('scripts', function() {
  return gulp.src(['./src/jsmpg.js', './src/*.js'])
    .pipe(concat('jsmpg.js'))
    .pipe(gulp.dest('./'));
});
