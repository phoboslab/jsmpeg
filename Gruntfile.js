module.exports = function( grunt ) {


    var Script = [
        'jsmpg.js'
    ];


    grunt.registerTask( 'always' , [
        //'jshint',
        'clean',
        'git-describe',
        'createHash',
        'replace'
    ]);


    grunt.registerTask( 'default' , [
        'always',
        'uglify'
    ]);


    grunt.registerTask( 'dev' , [
        'always',
        'concat',
    ]);


    grunt.initConfig({

        pkg: grunt.file.readJSON( 'package.json' ),

        'git-describe': {
            'options': {
                prop: 'git-version'
            },
            dist : {}
        },

        jshint : {
            all : ([ 'Gruntfile.js' ]).concat( Script )
        },

        clean: {
            all: [ '<%= pkg.name %>-*.js' ]
        },

        replace: [{
            options: {
                patterns: [
                    {
                        match: /(\"version\")(.*?)(\")(.{1,}?)(\")/i,
                        replacement: '\"version\": \"<%= pkg.version %>\"'
                    },
                    {
                        match: /(\"main\")(.*?)(\")(.{1,}?)(\")/i,
                        replacement: '\"main\": \"<%= pkg.name %>-<%= pkg.version %>.min.js\"'
                    }
                ]
            },
            files: [
                {
                    src: 'package.json',
                    dest: 'package.json'
                },
                {
                    src: 'bower.json',
                    dest: 'bower.json'
                }
            ]
        }],

        concat: {
            options: {
                banner : '/*! <%= pkg.name %> - <%= pkg.version %> - <%= pkg.author.name %> - <%= grunt.config.get( \'git-hash\' ) %> - <%= grunt.template.today("yyyy-mm-dd") %> */\n\n\n'
            },
            build: {
                src: Script,
                dest: '<%= pkg.name %>-<%= pkg.version %>.js'
            }
        },

        uglify: {
            options: {
                banner : '/*! <%= pkg.name %> - <%= pkg.version %> - <%= pkg.author.name %> - <%= grunt.config.get( \'git-hash\' ) %> - <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            release : {
                files : {
                    '<%= pkg.name %>-<%= pkg.version %>.min.js' : Script
                }
            }
        }
    });


    [
        'grunt-contrib-jshint',
        'grunt-contrib-clean',
        'grunt-git-describe',
        'grunt-replace',
        'grunt-contrib-concat',
        'grunt-contrib-uglify'
    ]
    .forEach( grunt.loadNpmTasks );


    grunt.registerTask( 'createHash' , function() {

        grunt.task.requires( 'git-describe' );

        var rev = grunt.config.get( 'git-version' );
        var matches = rev.match( /(\-{0,1})+([A-Za-z0-9]{7})+(\-{0,1})/ );

        var hash = matches
            .filter(function( match ) {
                return match.length === 7;
            })
            .pop();

        if (matches && matches.length > 1) {
            grunt.config.set( 'git-hash' , hash );
        }
        else{
            grunt.config.set( 'git-hash' , rev );
        }
    });
};












