/**
 * This is a backbone model which store
 * the data for a Query/API Entity
 */
var QueryDataModel = Backbone.Model.extend({
    defaults: {
        'stars': {
            'min': 0,
            'max': 1000,
        },
        'language': 'assembly',
        'totalRepos': '-',
        'XRateRemaining': '-',
        'XRateLimit': '-',
    }
});
/**
 * This is a backbone model which store
 * the data for a Repo Entity
 */
var RepoModel = Backbone.Model.extend({
    initialize: function() {}
});

/**
 * This is a backbone collection which store
 * the list of Repos as collection
 */
var RepoList = Backbone.Collection.extend({
    model: RepoModel,
    parse: function(data) {
        _.extend(this, _.pick(data, ['total_count', 'incomplete_results']));
        return data.items;
    },
    url: 'https://api.github.com/search/repositories'
});

/**
 * This is a backbone view which is responsible
 * for rendering Header of the app
 */
var HeaderView = Backbone.View.extend({
    initialize: function() {
        // listen to update event on model
        this.listenTo(this.model, 'update', this.render);
        this.render();
    },
    render: function() {
        var headerTemplate = _.template($('#Tpl-header').html());
        this.$el.html(headerTemplate(this.model.toJSON()));
        $('#app-header-container').html(this.el);
    }
});
/**
 * This is a backbone view which is responsible
 * for rendering Repo list and filter options
 */
var BodyView = Backbone.View.extend({
    events: {
        'change input.autocomplete': 'updateSearchData',
        'click .card-panel': 'goToRepo',
    },
    initialize: function(data) {
        /**
         extend view with data so that custom data which was passed while
         initializing view can also get attached to view
        **/
        _.extend(this, data);

        this.renderBody();
        /*
          When ever data inside collection is fetched from server 'sync' event
          will be triggered & then we can render the Repos as list inside this view
        */
        this.listenTo(this.collection, 'sync', this.renderReposList);
        this.listenTo(this.queryData, 'change', this.fetchRepos);
        this.listenTo(this.queryData, 'update', this.renderFilter);
        this.fetchRepos();
    },
    /** update queryData model with new search term
     *   or new star filter range
     **/
    updateSearchData: function(e) {
        var that = this;
        if (e.currentTarget) {
            _.delay(function() {
                that.queryData.set({
                    language: $(e.currentTarget).val()
                });
            }, 500);
        } else {
            this.queryData.set({
                stars: {
                    min: e['0'],
                    max: e['1']
                }
            });
        }
    },

    /** fetch the new set of repos based on new
     *   filter/search data (queryData)
     */
    fetchRepos: function() {
        var that = this;
        $('#repo-list-container #loader').show();
        $('#repo-list-container #repo-list').html('');
        this.collection.fetch({
            data: {
                q: 'stars:' + this.queryData.get('stars').min + '..' + this.queryData.get('stars').max + ' language:' + this.queryData.get('language'),
                sort: 'stars',
                order: 'desc'
            },
            success: function(collection, response, options) {
                // when we get response back we need to update
                // X-RateLimit values

                // siliently update this data
                // we dont want to backbone to trigger change event for this.
                // because change event is used for changes done by user
                // using search autocomplete or start range
                that.queryData.set({
                    'XRateRemaining': options.xhr.getResponseHeader('X-RateLimit-Remaining'),
                    'XRateLimit': options.xhr.getResponseHeader('X-RateLimit-Limit'),
                    'totalRepos': response.total_count,
                    'language': that.queryData.get('language')
                }, {
                    silent: true
                });
                // instead , we are emmiting update event here
                that.queryData.trigger('update');
            }
        });
    },
    renderBody: function() {
        this.$el.html(_.template($('#Tpl-body').html()));
        $('#app-body-container').html(this.el);
        this.activateAutocomplete();
        this.renderFilter();
    },
    /**
     * filter is the side filter which has start range widget
     * actually side filter has rendered twice
     * # one for mobile view (which comes when user Swipes right)
     * # other side filter is for devices tablets and above
     */
    renderFilter: function() {
        $('.drag-target,#sidenav-overlay').remove();
        $('#app-body-container .rightContent.hide-on-med-and-up').html(_.template($('#Tpl-filterMobile').html())(this.queryData.toJSON()));
        $('#app-body-container .rightContent.hide-on-small-only').html(_.template($('#Tpl-filter').html())(this.queryData.toJSON()));
        $('.button-collapse').sideNav({
            menuWidth: 300,
            edge: 'right',
            closeOnClick: true
        });
        this.activateSlider();
    },
    // side filter has a slider (star Range) which we have to activate
    activateSlider: function() {
        var that = this;
        var sliders = $('.starSlider');
        _.each(sliders, function(slider) {
            noUiSlider.create(slider, {
                start: [that.queryData.get('stars').min, that.queryData.get('stars').max],
                connect: true,
                step: 1,
                range: {
                    'min': 0,
                    'max': 1000
                },
                format: wNumb({
                    decimals: 0
                })
            });
            slider.noUiSlider.on('set', function(e) {
                that.updateSearchData(e);
            });
        });

    },
    // also activate the autocomplete search widget
    activateAutocomplete: function() {
        $.getJSON('https://rawgit.com/ashishsajwan/topgit-sap/gh-pages/data/languages.json', function(json) {
            $('input.autocomplete').autocomplete({
                data: json
            });
        });
    },
    // render Repo List
    renderReposList: function() {
        var listHtml = '';
        var repoTemplate = _.template($('#Tpl-repo').html());
        if (this.collection.total_count) {
            _.each(this.collection.models, function(model, key) {
                listHtml += repoTemplate(model.toJSON());
            });
        } else {
            listHtml += '<div class="center-align">Oops.. couldn\'t find any such repositories</div>';
        }
        $('#repo-list-container #loader').hide();
        $('#repo-list').html(listHtml);
    },
    // when clicked on repo it takes user to repo page in new tab
    goToRepo: function(e) {
        window.open($(e.currentTarget).attr('data-link'));
    }
})

$(document).ready(function() {
    var queryDataModel = new QueryDataModel();

    // create a object of Headerview
    // which will render header view of app
    var headerView = new HeaderView({
        model: queryDataModel
    });

    var bodyView = new BodyView({
        queryData: queryDataModel,
        // along with normal collection
        collection: new RepoList()
    });
});
