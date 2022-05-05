<?php


set_time_limit(0);

require_once __DIR__ . '/../discourse-api-php/lib/DiscourseAPI.php';

require_once __DIR__ . '/../../../maintenance/Maintenance.php';

use MediaWiki\Revision\RevisionRecord;

/**
 * Maintenance script that creates discourse threads for each discussion started in CommentStream
 *
 * @ingroup Maintenance
 */
class cs_2_discourse extends Maintenance {

    private $topicForPage = array();
    private $usersToSubscribe = array();

	public function __construct() {
		parent::__construct();

        $this->topicForPage = array();
        $this->usersToSubscribe = array();
	}

	public function execute() {
		$this->output( "Start\n\n" );

        // SELECT cst_page_id, cst_assoc_page_id, cst_comment_title, page_title
        // FROM `cs_comment_data`
        // INNER JOIN page ON page.page_id = cs_comment_data.cst_assoc_page_id
        // WHERE cst_parent_page_id IS NULL

		$dbr = $this->getDB( DB_REPLICA );
		$res = $dbr->select(
			[ 'cs_comment_data', 'page' ],
			[ 'cst_page_id', 'cst_assoc_page_id', 'cst_comment_title', 'page_title' ],
			'cst_parent_page_id IS NULL',
			__METHOD__,
			[],
			[ 'page' => [ 'INNER JOIN', 'page.page_id = cs_comment_data.cst_assoc_page_id' ] ]
		);

		foreach ( $res as $row ) {

            if (13691 != $row->cst_assoc_page_id)
                continue;

            $this->createTopicForPage($row->cst_assoc_page_id, $row->cst_comment_title, $row->cst_page_id);
		}

        $this->subscribeUsers();

        $this->output( "\n" );
	}


    private function createTopicForPage($pageId, $commentTitle, $commentPageId)
    {
        $api = $this->getAPI();

        $topicId = false;

        if (isset($this->topicForPage[$pageId]))
            $topicId = $this->topicForPage[$pageId];
        else
        {
            // Create the new topic in discourse...!

            // First, get the page info:
            $wikipage = WikiPage::newFromId( $pageId );
            $wikiTitle = $wikipage->getTitle();

            $username = $this->getUserNameForWikiPage($wikipage);
            $pageURL = $wikiTitle->getFullURL('', false, 'https://');
            $pageId = $wikiTitle->getArticleID();

            $this->output( "@@ Discussion de la page $wikiTitle ($username)\n" );

            $topicId = $this->findTopicForURL($pageURL);

            if (!$topicId)
            {
                // Create the topic now
                $text = "<p>Ce sujet de discussion accompagne la page <br><a href=\"$pageURL\">$wikiTitle</a></p>";

                // create a topic
                $r = $api->createTopicForEmbed(
                    'Discussion - ' . $wikiTitle,
                    $text,
                    false, // category id
                    $username,
                    $pageURL,
                    $pageId
                );

                if (empty($r->apiresult) || !isset($r->apiresult->id))
                {
                    throw new Exception("Error Processing Request " . print_r($r, true), 1);
                }

                $topicId = $r->apiresult->id;

                $this->usersToSubscribe[$username][$topicId] = true;
            }

            // cache the topic id
            $this->topicForPage[$pageId] = $topicId;
        }

        // Create a reply for this comment/question:
        $commentPage = WikiPage::newFromId( $commentPageId );

        $content = $commentPage->getContent( RevisionRecord::FOR_PUBLIC ); // RevisionRecord::RAW );
        $html = ContentHandler::getContentText( $content );

        $html = preg_replace('@{{[^}]+}}@', '', $html);

        $html = "<p><b>$commentTitle</b></p>$html";

        $username = $this->getUserNameForWikiPage($commentPage);
        $created_at = $this->getPageDate($commentPage);

        $this->usersToSubscribe[$username][$topicId] = true;

        echo "$commentTitle - $username - $created_at \n";
        $r = $api->createPost($html, $topicId, $username, $created_at);
        if (empty($r->apiresult) || !isset($r->apiresult->id))
        {
            throw new Exception("Error Processing Request " . print_r($r, true), 1);
        }

        $postNumber = $r->apiresult->post_number;

		$dbr = $this->getDB( DB_REPLICA );
		$res = $dbr->select(
			[ 'cs_comment_data' ],
			[ 'cst_page_id' ],
            [ 'cst_parent_page_id' => $commentPageId ],
			__METHOD__,
			[]
		);

		foreach ( $res as $row ) {
            $this->createReply($row->cst_page_id, $topicId, $postNumber);
		}

        sleep(2);
    }

    /**
     * Create a reply
     */
    function createReply($commentPageId, $topicId, $postNumber)
    {
        $api = $this->getAPI();

        // Create a reply for this comment/question:
        $commentPage = WikiPage::newFromId( $commentPageId );

        $content = $commentPage->getContent( RevisionRecord::FOR_PUBLIC ); // RevisionRecord::RAW );
        $html = ContentHandler::getContentText( $content );

        $html = preg_replace('@{{[^}]+}}@', '', $html);

        $username = $this->getUserNameForWikiPage($commentPage);
        $created_at = $this->getPageDate($commentPage);

        $this->usersToSubscribe[$username][$topicId] = true;

        echo "$username - $created_at - $html\n";
        $r = $api->createPost($html, $topicId, $username, $created_at, $postNumber);

        if (empty($r->apiresult) || !isset($r->apiresult->post->id))
        {
            throw new Exception("Error Processing Request " . print_r($r, true), 1);
        }
    }

    function getAPI()
    {
        $apikey = '6b5d848d0414dfa868cbbf5777d6689d4d205ea7a64868492fd86e71ce594a80';
        $apiHost = 'app';

        return new DiscourseAPI($apiHost, $apikey, 'http', '', '', strpos($apiHost, 'dev') !== false);
    }
    function getPageDate($wikipage)
    {
        $ts = $wikipage->getTimestamp();

        $matches = array();
        if (preg_match('@([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})@', $ts, $matches))
            return $matches[1] . '-' . $matches[2] . '-' . $matches[3] . ' ' . ($matches[4] - 2) . ':' . $matches[5] . ':' . $matches[6];

        return null;
    }

    function getUserNameForWikiPage($wikipage)
    {
        $api = $this->getAPI();

        // Maybe we should take the user with the most revisions, or the first, ...?
        $lastUserId = $wikipage->getUser();
        $user = User::newFromId( $lastUserId );

        $userEmail = $user->getEmail();
        $userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

        $username = $api->getUsernameByEmail($userEmail);
        if (empty($username))
        {
            $this->output( "Could not find discourse user for email $userEmail - please check that this email was verified.\n" );
            $username = 'astrid.robette';
        }

        // SELECT * FROM `users` WHERE `email` IN ('astrid.robette@neayi.com', 'b.estanguet@valdegascogne.coop',  'bertrand.gorge@neayi.com',  'delphine.da-costa@bio-occitanie.org',  'didier.fertil@m-g-p.fr',  'etadesmarais@hotmail.fr',  'hartmax@hotmail.fr',  'jd4s@orange.fr',  'maraichportecluse09@orange.fr',  'pieter@hortiproyect.eu',  'samuelfoubert@orange.fr',  'st.perrault2611@gmail.com',  'suzor@herault.chambagri.fr',  'v.soulere@hautes-pyrenees.chambagri.fr',  'zionamap@gmail.com')

        return $username;
    }

    function findTopicForURL($url)
    {
        $api = $this->getAPI();

        $r = $api->getPostsByEmbeddedURL($url);

        if (empty($r->apiresult) || !isset($r->apiresult->topic_id))
            return false;

        return $r->apiresult->topic_id;
    }

    /**
     * Loop through all the users that have posted some post and make sure they watch the topic
     */
    function subscribeUsers()
    {
        $api = $this->getAPI();

        // By default users who participated to the conversation are watching at level 2, so we bump them
        // to level 3
        foreach ($this->usersToSubscribe as $username => $topics)
            foreach ($topics as $topicId => $v)
                $api->watchTopic($topicId, $username);

        // Now for each topic for which a thread has been created, ask insights
        // about who decided to follow the page and subscribe them too:

        foreach ($this->topicForPage as $pageId => $topicId)
        {
            $insightsURL = 'http://insights/';

			$url = $insightsURL . "api/page/$pageId/followers?type=follow";

            $ch = curl_init();

            //     curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
            //     curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);

            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            $body = curl_exec($ch);

            $curl_errno = curl_errno($ch);
            $curl_error = curl_error($ch);

            if ($curl_errno > 0) {
                throw new Exception("cURL Error ($curl_errno): $curl_error", 1);
            }

            $rc = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $resObj = new \stdClass();
            $resObj->http_code = $rc;
            $resObj->apiresult = json_decode($body);

            if (empty($resObj->apiresult) || !isset($resObj->apiresult->data))
            {
                throw new Exception("Error Processing Request " . print_r($resObj, true), 1);
            }

            foreach ($resObj->apiresult->data as $aFollower)
            {
                if (empty($aFollower->user->discourse_username))
                {
                    $this->output("Empty follower : " . print_r($aFollower, true) . "\n");
                    continue;
                }

                $username = $aFollower->user->discourse_username;

                $api->watchTopic($topicId, $username);

                $this->output("Whatching $topicId -> " . $username . "\n");
            }
        }
    }
}

$maintClass = cs_2_discourse::class;
require_once RUN_MAINTENANCE_IF_MAIN;
